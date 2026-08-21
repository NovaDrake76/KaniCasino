import SocketConnection from "../socket";

const socket = SocketConnection.getInstance();

export interface PooledItem {
  uniqueId: string;
  itemId?: string;
  name: string;
  image: string;
  rarity: string;
  value: number;
  stakedBy: number;
}

export interface PokerSeat {
  seat: number;
  userId: string | null;
  username: string;
  profilePicture: string;
  stack: number;
  committed: number;
  totalCommitted: number;
  status: "empty" | "sitting" | "active" | "folded" | "allin" | "sittingout";
  leaveAfterHand: boolean;
  // null means hidden: somebody else's cards, or your own before a deal
  holeCards: number[] | null;
}

export interface PokerPot {
  amount: number;
  eligible: number[];
}

export interface PokerTable {
  _id: string;
  slug: string;
  name: string;
  seatCount: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  handNumber: number;
  button: number;
  status: "idle" | "dealing" | "betting" | "showdown" | "settling";
  street: "preflop" | "flop" | "turn" | "river" | null;
  board: number[];
  pots: PokerPot[];
  currentBet: number;
  minRaise: number;
  toAct: number | null;
  actionDeadline: string | null;
  actionSeq: number;
  pfServerSeedHash: string | null;
  pool: PooledItem[];
  atRisk: PooledItem[];
  seats: PokerSeat[];
}

export interface LobbyTable {
  _id: string;
  slug: string;
  name: string;
  seatCount: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  seated: number;
  status: string;
  handNumber: number;
  players: { seat: number; username: string; profilePicture: string; stack: number }[];
  poolValue: number;
  poolCount: number;
  topAtRisk: { name: string; image: string; rarity: string; value: number } | null;
  atRiskCount: number;
}

export interface CashOutOptions {
  seat: number;
  stack: number;
  reserved: PooledItem[];
  open: PooledItem[];
  spare: number;
}

export type ActionType = "fold" | "check" | "call" | "bet" | "raise";

// a socket that is down never calls the ack back, and a lobby that waits forever shows
// loading skeletons forever. every call resolves one way or another.
const ACK_TIMEOUT_MS = 8000;

const ack = <T,>(event: string, ...args: unknown[]): Promise<T> =>
  new Promise((resolve) => {
    let done = false;
    const settle = (res: T) => {
      if (done) return;
      done = true;
      resolve(res);
    };
    const timer = setTimeout(
      () => settle({ error: "The table server is not responding" } as T),
      ACK_TIMEOUT_MS
    );
    socket.emit(event, ...args, (res: T) => {
      clearTimeout(timer);
      settle(res);
    });
  });

export const getSocket = () => socket;

export const getLobby = () => ack<{ tables: LobbyTable[] }>("poker:lobby", null);
export const watchTable = (tableId: string) =>
  ack<{ table?: PokerTable; error?: string }>("poker:watch", tableId);
export const unwatchTable = (tableId: string) => socket.emit("poker:unwatch", tableId);

export const sitDown = (payload: { tableId: string; seat: number; kp: number; uniqueIds: string[] }) =>
  ack<{ ok?: boolean; seat?: number; stack?: number; error?: string }>("poker:sit", payload);

export interface StakeableItem {
  uniqueId: string;
  itemId: string;
  name: string;
  image: string;
  rarity: string;
  value: number;
}

// one row per copy, because escrow takes a specific uniqueId and not a kind of item
export const getStakeable = () =>
  ack<{ items: StakeableItem[]; walletBalance: number; error?: string }>("poker:stakeable", null);

// three timeouts running sits a player out, and this is how they come back
export const sitBackIn = (tableId: string) =>
  ack<{ ok?: boolean; error?: string }>("poker:sitIn", tableId);

export const getCashOutOptions = (tableId: string) =>
  ack<CashOutOptions & { error?: string }>("poker:cashoutOptions", tableId);

export const leaveTable = (tableId: string, picks?: string[]) =>
  ack<{ ok?: boolean; queued?: boolean; items?: PooledItem[]; kp?: number; error?: string }>(
    "poker:leave",
    { tableId, picks }
  );

export const sendAction = (tableId: string, action: ActionType, to?: number) =>
  ack<{ ok?: boolean; error?: string }>("poker:action", { tableId, action, to });

export const getHistory = (tableId: string) => ack<{ hands: unknown[] }>("poker:history", tableId);
