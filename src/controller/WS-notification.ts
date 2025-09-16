import { USERS } from "../model/User";
import { WebSocketServer } from "ws";

type typeNotification = {
  [uuid: string]: { uuid: string; isHave: boolean }[];
};

const NOTIFICATIONS: typeNotification = {};

const WSS_Notifications = new WebSocketServer({ noServer: true });

WSS_Notifications.on("connection", (ws, req) => {
  if (!req.url) return;

  // https://realtime-chat-vne1.onrender.com
  const url = new URL(req.url, "https://realtime-chat-vne1.onrender.com");

  const myUUID = url.searchParams.get("my-uuid");
  if (!myUUID) {
    ws.close();
    return;
  }
  NOTIFICATIONS[myUUID] = []

  ws.on("message", (data) => {

  });
});




export {WSS_Notifications}