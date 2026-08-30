import SocketConnection from "../socket";

export interface LiveBet {
  id: string;
  at: number;
  game: string;
  userId: string;
  username: string;
  profilePicture: string;
  level: number;
  badge: { key: string; label?: string | null; note?: string | null } | null;
  bet: number;
  multiplier: number;
  payout: number;
}

// the feed is broadcast, never fetched: the server holds the last rows in memory and hands
// them over on request, so nothing here polls and nothing is stored.
export const subscribeToLiveBets = (
  onBatch: (rows: LiveBet[]) => void,
  onOne: (row: LiveBet) => void
) => {
  const socket = SocketConnection.getInstance();
  // the socket is already connected by the time a game page mounts, so the copy the
  // server sends on connect arrives to no listener. ask for it, and again on a reconnect.
  const ask = () => socket.emit("liveBet:request");

  socket.on("liveBet:recent", onBatch);
  socket.on("liveBet", onOne);
  socket.on("connect", ask);
  ask();

  return () => {
    socket.off("liveBet:recent", onBatch);
    socket.off("liveBet", onOne);
    // by handler, never the bare event: the socket is a singleton and App listens on
    // connect too
    socket.off("connect", ask);
  };
};
