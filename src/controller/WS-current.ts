import type { typeCurrentChat, typeUser, ChatMessage } from "../types/types.js";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import { CHATS } from "../model/Chats.js";
import { USERS } from "../model/User.js";

const currentWSS = new WebSocketServer({ noServer: true });

currentWSS.on("connection", (ws, req) => {
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
  });
});

export { currentWSS };
