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
// them over on connect, so nothing here polls and nothing is stored.
export const subscribeToLiveBets = (
  onBatch: (rows: LiveBet[]) => void,
  onOne: (row: LiveBet) => void
) => {
  const socket = SocketConnection.getInstance();
  socket.on("liveBet:recent", onBatch);
  socket.on("liveBet", onOne);
  return () => {
    socket.off("liveBet:recent", onBatch);
    socket.off("liveBet", onOne);
  };
};
