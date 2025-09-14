// const express = require("express");
// const { WebSocketServer } = require("ws");
// const { v4: uuidv4 } = require("uuid");

// const app = express();
// const PORT = process.env.PORT || 8000;

// // ===== Хранилище =====
// // users = { uuid: { username, ws } }
// const users = {};

// // ===== WebSocket =====
// const wss = new WebSocketServer({ noServer: true });

// function sendJSON(ws, data) {
//   if (ws.readyState === ws.OPEN) {
//     ws.send(JSON.stringify(data));
//   }
// }

// // broadcast всем кроме инициатора
// function broadcastToAll(data, exceptUUID = null) {
//   Object.entries(users).forEach(([uuid, u]) => {
//     if (u.ws && u.ws.readyState === u.ws.OPEN && uuid !== exceptUUID) {
//       sendJSON(u.ws, data);
//     }
//   });
// }

// wss.on("connection", (ws) => {
//   // создаем нового пользователя
//   const userUUID = uuidv4();
//   const username = `User_${Math.floor(Math.random() * 10000)}`;

//   users[userUUID] = { username, ws };

//   // 1. Отправляем подключившемуся его данные
//   sendJSON(ws, {
//     type: "init",
//     user: { uuid: userUUID, username },
//   });

//   // 2. Отправляем ему список текущих онлайн-пользователей
//   const activeUsers = Object.entries(users)
//     .filter(([uuid, u]) => u.ws && uuid !== userUUID)
//     .map(([uuid, u]) => ({ uuid, username: u.username }));

//   sendJSON(ws, {
//     type: "activeUsers",
//     users: activeUsers,
//   });

//   // 3. Уведомляем остальных о новом пользователе
//   broadcastToAll(
//     { type: "newUser", user: { uuid: userUUID, username } },
//     userUUID
//   );

//   // 4. Обработка сообщений
//   ws.on("message", (msg) => {
//     const messageObj = {
//       type: "message",
//       from: userUUID,
//       username,
//       message: msg.toString(),
//     };

//     // рассылаем всем
//     broadcastToAll(messageObj);
//   });

//   // 5. Когда пользователь отключается
//   ws.on("close", () => {
//     delete users[userUUID];
//     broadcastToAll({ type: "userLeft", uuid: userUUID });
//   });
// });

// // ===== HTTP сервер =====
// const server = app.listen(PORT, () =>
//   console.log(`Server running on port ${PORT}`)
// );

// server.on("upgrade", (request, socket, head) => {
//   // подключение всех к одному общему wss
//   if (request.url.startsWith("/ws")) {
//     wss.handleUpgrade(request, socket, head, (ws) => {
//       wss.emit("connection", ws, request);
//     });
//   } else {
//     socket.destroy();
//   }
// });

const express = require("express");
const { WebSocketServer } = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 8000;

// ===== Хранилище =====
// users = { uuid: { username, ws, unread: {} } }
const users = {};

// Словарь для генерации реалистичных имён
const adjectives = [
  "Sunny",
  "Misty",
  "Silent",
  "Brave",
  "Happy",
  "Dark",
  "Wild",
  "Clever",
  "Magic",
];
const nouns = [
  "Fox",
  "Bear",
  "Wolf",
  "Sky",
  "River",
  "Star",
  "Lion",
  "Tiger",
  "Cloud",
  "Eagle",
];

function generateUsername() {
  let username;
  do {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    username = `${adj}${noun}${number}`;
  } while (Object.values(users).some((u) => u.username === username));
  return username;
}

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

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  // создаем нового пользователя
  const userUUID = uuidv4();
  const username = generateUsername();

  users[userUUID] = { username, ws, unread: {} };

  // 1. Отправляем подключившемуся его данные
  sendJSON(ws, {
    type: "init",
    user: { uuid: userUUID, username },
  });

  // 2. Отправляем ему список текущих онлайн-пользователей
  const activeUsers = Object.entries(users)
    .filter(([uuid]) => uuid !== userUUID)
    .map(([uuid, u]) => ({
      uuid,
      username: u.username,
    }));

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
  ws.on("message", (rawMsg) => {
    let msg;
    try {
      msg = JSON.parse(rawMsg.toString());
    } catch (e) {
      return;
    }

    if (msg.type === "message") {
      // общее сообщение
      const messageObj = {
        type: "message",
        from: userUUID,
        username,
        message: msg.message,
      };
      broadcastToAll(messageObj);
    }

    if (msg.type === "private" && msg.to) {
      // приватное сообщение
      const recipient = users[msg.to];
      if (recipient && recipient.ws.readyState === recipient.ws.OPEN) {
        const privateMsg = {
          type: "private",
          from: userUUID,
          username,
          message: msg.message,
        };
        sendJSON(recipient.ws, privateMsg);

        // непрочитанные (если не в активном чате, на фронте надо обрабатывать)
        recipient.unread[userUUID] = (recipient.unread[userUUID] || 0) + 1;

        // можно уведомить отправителя, что сообщение доставлено
        sendJSON(ws, { type: "delivered", to: msg.to });
      }
    }
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
  if (request.url.startsWith("/ws")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});
