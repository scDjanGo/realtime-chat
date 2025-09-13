const express = require('express');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ===== Хранилища =====
// users = { uuid: { username, ws? } }
const users = {};

// individualChats = { [uuid1]: { [uuid2]: [{ userUUID, message }] } }
const individualChats = {};

// groups = { groupId: { name, clients: [{ uuid }], messages: [{ userUUID, message }] } }
const groups = {};

// ===== API =====

// 1. Создание уникального пользователя
app.post('/api/create-user', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "username is required" });

  const userUUID = uuidv4();
  users[userUUID] = { username };
  res.json({ userUUID, username });
});

// 2. Получение списка активных пользователей
app.get('/api/active-users', (req, res) => {
  const activeUsers = Object.entries(users)
    .filter(([uuid, u]) => u.ws) // только подключенные через WS
    .map(([uuid, u]) => ({ uuid, username: u.username }));

  res.json(activeUsers);
});

// 3. Создание группы
app.post('/api/create-group', (req, res) => {
  const { clients } = req.body; // массив uuid пользователей
  if (!Array.isArray(clients) || clients.length === 0)
    return res.status(400).json({ error: 'clients должен быть массивом uuid' });

  const groupId = uuidv4();
  const groupName = `Group_${Math.floor(Math.random() * 10000)}`;
  groups[groupId] = {
    name: groupName,
    clients: clients.map(uuid => ({ uuid })),
    messages: [],
  };

  res.json({ groupId, groupName, clients });
});

// 4. Получение данных группы
app.get('/api/group/:groupId', (req, res) => {
  const { groupId } = req.params;
  const group = groups[groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const activeClients = group.clients.filter(c => users[c.uuid]?.ws).map(c => c.uuid);
  res.json({
    groupId,
    groupName: group.name,
    totalClients: group.clients.length,
    activeClients,
    messages: group.messages,
  });
});

// ===== WebSocket =====
const wss = new WebSocketServer({ noServer: true });

// helper для отправки сообщений
function sendJSON(ws, data) {
  ws.send(JSON.stringify(data));
}

wss.on('connection', (ws, request, type, params) => {
  // type = 'individual' | 'group'
  // params = { uuid, peerUUID } или { groupId, uuid }
  
  if (type === 'individual') {
    const { uuid, peerUUID } = params;
    users[uuid].ws = ws;

    ws.on('message', msg => {
      const messageObj = { userUUID: uuid, message: msg.toString() };

      // Сохраняем в истории
      if (!individualChats[uuid]) individualChats[uuid] = {};
      if (!individualChats[uuid][peerUUID]) individualChats[uuid][peerUUID] = [];
      individualChats[uuid][peerUUID].push(messageObj);

      // Дублируем для другого пользователя
      if (!individualChats[peerUUID]) individualChats[peerUUID] = {};
      if (!individualChats[peerUUID][uuid]) individualChats[peerUUID][uuid] = [];
      individualChats[peerUUID][uuid].push(messageObj);

      // Отправка другому пользователю, если онлайн
      const peerWS = users[peerUUID]?.ws;
      if (peerWS && peerWS.readyState === ws.OPEN) {
        sendJSON(peerWS, messageObj);
      }
    });

    ws.on('close', () => {
      delete users[uuid].ws;
    });

  } else if (type === 'group') {
    const { groupId, uuid } = params;
    users[uuid].ws = ws;

    ws.on('message', msg => {
      const group = groups[groupId];
      if (!group) return;

      const messageObj = { userUUID: uuid, message: msg.toString() };
      group.messages.push(messageObj);

      // Отправка всем участникам группы
      group.clients.forEach(c => {
        const clientWS = users[c.uuid]?.ws;
        if (clientWS && clientWS.readyState === ws.OPEN) {
          sendJSON(clientWS, messageObj);
        }
      });
    });

    ws.on('close', () => {
      delete users[uuid].ws;
    });
  }
});

// ===== Подключение через HTTP сервер =====
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

server.on('upgrade', (request, socket, head) => {
  const url = request.url;

  // ws://server/ws/individual/<uuid>/<peerUUID>
  if (url.startsWith('/ws/individual/')) {
    const [_, __, uuid, peerUUID] = url.split('/');
    if (!users[uuid] || !users[peerUUID]) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request, 'individual', { uuid, peerUUID });
    });

  // ws://server/ws/group/<groupId>/<uuid>
  } else if (url.startsWith('/ws/group/')) {
    const [_, __, groupId, uuid] = url.split('/');
    if (!groups[groupId] || !users[uuid]) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request, 'group', { groupId, uuid });
    });

  } else {
    socket.destroy();
  }
});
