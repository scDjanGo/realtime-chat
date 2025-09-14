const express = require("express");
const { WebSocketServer } = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 8000;

// ===== Хранилище =====
// users = { uuid: { username, ws } }
const users = {};

// ===== WebSocket =====
const wss = new WebSocketServer({ noServer: true });

function sendJSON(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// broadcast всем кроме инициатора
function broadcastToAll(data, exceptUUID = null) {
  Object.entries(users).forEach(([uuid, u]) => {
    if (u.ws && u.ws.readyState === u.ws.OPEN && uuid !== exceptUUID) {
      sendJSON(u.ws, data);
    }
  });
}

wss.on("connection", (ws) => {
  // создаем нового пользователя
  const userUUID = uuidv4();
  const username = `User_${Math.floor(Math.random() * 10000)}`;

  users[userUUID] = { username, ws };

  // 1. Отправляем подключившемуся его данные
  sendJSON(ws, {
    type: "init",
    user: { uuid: userUUID, username },
  });

  // 2. Отправляем ему список текущих онлайн-пользователей
  const activeUsers = Object.entries(users)
    .filter(([uuid, u]) => u.ws && uuid !== userUUID)
    .map(([uuid, u]) => ({ uuid, username: u.username }));

  sendJSON(ws, {
    type: "activeUsers",
    users: activeUsers,
  });

  // 3. Уведомляем остальных о новом пользователе
  broadcastToAll(
    { type: "newUser", user: { uuid: userUUID, username } },
    userUUID
  );

  // 4. Обработка сообщений
  ws.on("message", (msg) => {
    const messageObj = {
      type: "message",
      from: userUUID,
      username,
      message: msg.toString(),
    };

    // рассылаем всем
    broadcastToAll(messageObj);
  });

  // 5. Когда пользователь отключается
  ws.on("close", () => {
    delete users[userUUID];
    broadcastToAll({ type: "userLeft", uuid: userUUID });
  });
});

// ===== HTTP сервер =====
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

server.on("upgrade", (request, socket, head) => {
  // подключение всех к одному общему wss
  if (request.url.startsWith("/ws")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});
