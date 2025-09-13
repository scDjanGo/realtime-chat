const express = require('express');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Хранилище комнат и сообщений
const rooms = {};

// Создаем WebSocket сервер
const wss = new WebSocketServer({ noServer: true });

// Обработка соединений
wss.on('connection', (ws, request, roomId) => {
  console.log(`Пользователь подключился к комнате ${roomId}`);

  ws.on('message', (message) => {
    // Рассылаем всем участникам комнаты
    rooms[roomId].forEach(client => {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    rooms[roomId] = rooms[roomId].filter(client => client !== ws);
    console.log(`Пользователь вышел из комнаты ${roomId}`);
  });

  // Добавляем клиента в комнату
  rooms[roomId].push(ws);
});

// API для создания комнаты
app.get('/create-room', (req, res) => {
  const roomId = uuidv4();
  rooms[roomId] = [];
  res.json({ roomId, link: `/room/${roomId}` });
});

// Подключение WebSocket через HTTP сервер
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
  const url = request.url;

  if (url.startsWith('/ws/')) {
    const roomId = url.split('/ws/')[1];

    if (!rooms[roomId]) {
      // Комната не существует
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, roomId);
    });
  } else {
    socket.destroy();
  }
});
