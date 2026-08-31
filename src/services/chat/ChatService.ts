import SocketConnection from "../socket";

export interface ChatBadge {
  key: string;
  label?: string | null;
  note?: string | null;
}

export interface ChatMessage {
  id: string;
  // the Player component links and renders the avatar off _id, so the row carries it
  _id: string;
  userId: string;
  username: string;
  slug?: string | null;
  profilePicture?: string | null;
  level: number;
  badge?: ChatBadge | null;
  text: string;
  at: number;
}

export interface SendResult {
  ok?: boolean;
  error?: string;
  minLevel?: number;
}

const socket = () => SocketConnection.getInstance();

// the panel mounts long after the socket connects, so history is asked for rather than
// waited on. same reason the bet ticker does it.
export const requestHistory = () => socket().emit("chat:request");

export const sendMessage = (text: string): Promise<SendResult> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ error: "failed" }), 8000);
    socket().emit("chat:send", { text }, (result: SendResult) => {
      clearTimeout(timer);
      resolve(result || { error: "failed" });
    });
  });

export const reportMessage = (id: string, reason?: string): Promise<SendResult> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ error: "failed" }), 8000);
    socket().emit("chat:report", { id, reason }, (result: SendResult) => {
      clearTimeout(timer);
      resolve(result || { error: "failed" });
    });
  });

export const onMessage = (fn: (m: ChatMessage) => void) => {
  socket().on("chat:message", fn);
  return () => void socket().off("chat:message", fn);
};

export const onHistory = (fn: (m: ChatMessage[]) => void) => {
  socket().on("chat:recent", fn);
  return () => void socket().off("chat:recent", fn);
};

export const onRemoved = (fn: (p: { id: string }) => void) => {
  socket().on("chat:removed", fn);
  return () => void socket().off("chat:removed", fn);
};
