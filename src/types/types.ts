export type typeUser = {
  username: string;
  ws: WebSocket;
  unread: Record<string, number>;
};

export type ChatMessage = {
  from: string;
  to: string;
  text: string;
  timestamp: number;
  uuid: string
};

export type ChatRoom = {
  users: [string, string];
  messages: ChatMessage[];
  unread: Record<string, number>;
};


export type typeCurrentChat = {
  uuid: string,
  user_1: string,
  user_2: string,
  messages: ChatMessage[]
}