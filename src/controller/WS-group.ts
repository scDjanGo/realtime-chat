import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import { USERS } from "../model/User.js";

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

const MESSAGES: any[] = [];

function generateUsername() {
  let username: string | undefined;
  do {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    username = `${adj}${noun}${number}`;
  } while (Object.values(USERS).some((u) => u.username === username));
  return username;
}

function sendJSON(ws: WebSocket, data: any) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
    if (data.type === "message") {
      MESSAGES.push(data);
    }
  }
}

function broadcastToAll(data: any, exceptUUID: string | null = null): void {
  Object.entries(USERS).forEach(([uuid, u]: any) => {
    if (u.ws && u.ws.readyState === u.ws.OPEN && uuid !== exceptUUID) {
      sendJSON(u.ws, data);
    }
  });
}

const WSS = new WebSocketServer({ noServer: true });

WSS.on("connection", (ws: any) => {
  const userUUID = uuidv4();
  const username = generateUsername();

  USERS[userUUID] = { username, ws, unread: {} };

  sendJSON(ws, {
    type: "init",
    user: { uuid: userUUID, username },
  });

  const activeUsers = Object.entries(USERS)
    .filter(([uuid]) => uuid !== userUUID)
    .map(([uuid, u]: any) => ({ uuid, username: u?.username }));

  sendJSON(ws, {
    type: "activeUsers",
    users: activeUsers,
  });

  broadcastToAll(
    { type: "newUser", user: { uuid: userUUID, username } },
    userUUID
  );

  ws.send(JSON.stringify({ type: "history", data: MESSAGES.slice(-30, -1) }));

  ws.on("message", (rawMsg: any) => {
    let msg;
    try {
      msg = JSON.parse(rawMsg.toString());
    } catch (e) {
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

    
    if (msg.type === "admin") {
      // команда от админа

      const actions_of_admin = msg.message.split(" ")
      
      if(actions_of_admin.map((item: string) => item.toLowerCase()).includes("clear")) {
        MESSAGES.splice(0, MESSAGES.length - 1)
      }
    
    }
  });

  ws.on("close", () => {
    delete USERS[userUUID];
    broadcastToAll({ type: "userLeft", uuid: userUUID });
  });
});

export default WSS;
