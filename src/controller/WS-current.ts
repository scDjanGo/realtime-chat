import type { typeCurrentChat, typeUser, ChatMessage } from "../types/types.js";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import { CHATS } from "../model/Chats.js";
import { USERS } from "../model/User.js";
import { WSS_Notifications } from "./WS-notification.js";

const currentWSS = new WebSocketServer({ noServer: true });
const MESSAGES: ChatMessage[] = [];

currentWSS.on("connection", (ws, req) => {
  if (!req.url) return;

  // https://realtime-chat-vne1.onrender.com
  const url = new URL(req.url, "https://realtime-chat-vne1.onrender.com");

  const myUUID = url.searchParams.get("my-uuid");

  if (!myUUID) {
    ws.close();

    return;
  }

  USERS[myUUID] = { ...USERS[myUUID], ws: ws as any };
  const userMessages = MESSAGES.filter(
    (item) => item.from === myUUID || item.to === myUUID
  );

  ws.send(JSON.stringify({ type: "history", data: userMessages }));

  ws.on("message", (msg: string) => {
    let data = JSON.parse(msg);
    const currentChatUUID = uuidv4();
    let currentChat: null | typeCurrentChat = null;

    CHATS.forEach((item) => {
      if (
        (item.user_1 === data.from && item.user_2 === data.to) ||
        (item.user_1 === data.to && item.user_2 === data.from)
      ) {
        currentChat = item;
      }
    });

    if (!currentChat) {
      currentChat = {
        uuid: currentChatUUID,
        user_1: data.from,
        user_2: data.to,
        messages: [],
      };
    }

    currentChat.messages.push(data);

    let chatIndex = CHATS.findIndex((item) => item.uuid === currentChat?.uuid);

    if (chatIndex < 0) {
      CHATS.push(currentChat);
    } else {
      CHATS.splice(chatIndex, 1, currentChat);
    }

    [data.from, data.to].forEach((uuid) => {
      const user = USERS[uuid];
      if (user?.ws && user.ws.readyState === user.ws.OPEN) {
        user.ws.send(JSON.stringify(data));
      }
    });

    MESSAGES.push(data);
  });
});

export { currentWSS };
