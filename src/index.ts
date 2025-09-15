import express from "express";
import WSS from "./controller/WS-group.js";
import { currentWSS } from "./controller/WS-current.js";

const app = express();
const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

server.on("upgrade", (request: any, socket, head) => {
  if (request?.url.startsWith("/ws")) {
    WSS.handleUpgrade(request, socket, head, (ws) => {
      WSS.emit("connection", ws, request);
    });
  } else if (request?.url.startsWith("/chat")) {
    currentWSS.handleUpgrade(request, socket, head, (ws) => {
      currentWSS.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});
