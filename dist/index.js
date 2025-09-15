"use strict";
// const express = require("express");
// const { WebSocketServer } = require("ws");
// const { v4: uuidv4 } = require("uuid");
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const uuid_1 = require("uuid");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8000;
// ===== Хранилище =====
const users = {}; // users = { uuid: { username, ws, unread: {} } }
// Словарь для генерации имён
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
function broadcastToAll(data, exceptUUID = null) {
    Object.entries(users).forEach(([uuid, u]) => {
        if (u.ws && u.ws.readyState === u.ws.OPEN && uuid !== exceptUUID) {
            sendJSON(u.ws, data);
        }
    });
}
const wss = new ws_1.WebSocketServer({ noServer: true });
wss.on("connection", (ws) => {
    const userUUID = (0, uuid_1.v4)();
    const username = generateUsername();
    users[userUUID] = { username, ws, unread: {} };
    // 1. Отправляем подключившемуся его данные
    sendJSON(ws, {
        type: "init",
        user: { uuid: userUUID, username },
    });
    // 2. Отправляем список активных
    const activeUsers = Object.entries(users)
        .filter(([uuid]) => uuid !== userUUID)
        .map(([uuid, u]) => ({ uuid, username: u?.username }));
    sendJSON(ws, {
        type: "activeUsers",
        users: activeUsers,
    });
    // 3. Уведомляем остальных
    broadcastToAll({ type: "newUser", user: { uuid: userUUID, username } }, userUUID);
    // 4. Обработка сообщений
    ws.on("message", (rawMsg) => {
        let msg;
        try {
            msg = JSON.parse(rawMsg.toString());
        }
        catch (e) {
            return;
        }
        if (msg.type === "message") {
            // ==== ОБЩИЙ ЧАТ ====
            const messageObj = {
                type: "message",
                from: userUUID,
                username,
                message: msg.message,
            };
            broadcastToAll(messageObj);
        }
        if (msg.type === "private" && msg.to) {
            // ==== ПРИВАТНЫЙ ЧАТ ====
            const recipient = users[msg.to];
            if (recipient && recipient.ws.readyState === recipient.ws.OPEN) {
                const privateMsg = {
                    type: "private",
                    from: userUUID,
                    username,
                    message: msg.message,
                };
                sendJSON(recipient.ws, privateMsg);
                // Непрочитанные
                recipient.unread[userUUID] = (recipient.unread[userUUID] || 0) + 1;
                // Подтверждение доставлено
                sendJSON(ws, { type: "delivered", to: msg.to });
            }
        }
    });
    // 5. Когда отключается
    ws.on("close", () => {
        delete users[userUUID];
        broadcastToAll({ type: "userLeft", uuid: userUUID });
    });
});
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.on("upgrade", (request, socket, head) => {
    if (request?.url.startsWith("/ws")) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
        });
    }
    else {
        socket.destroy();
    }
});
