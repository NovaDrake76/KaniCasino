import SocketConnection from "../socket";

const socket = SocketConnection.getInstance();

export interface BattleItem {
  _id: string;
  name: string;
  image: string;
  rarity: string;
  baseValue?: number;
  uniqueId?: string;
}

export interface BattlePlayer {
  userId: string | null;
  username: string;
  profilePicture: string;
  team: number;
  slot: number;
  isBot: boolean;
  items: BattleItem[];
  total: number;
  clientSeed?: string | null;
}

export interface Battle {
  id: string;
  status: "waiting" | "in_progress" | "finished" | "cancelled";
  mode: string;
  bakaMode: boolean;
  cases: string[];
  entryCost: number;
  createdBy: string;
  currentRound: number;
  winnerUserIds: string[];
  winningTeam: number | null;
  tiedTeams: number[];
  pfServerSeedHash?: string | null;
  pfServerSeed?: string | null;
  players: BattlePlayer[];
}

export const MODE_SLOTS: Record<string, number> = {
  "1v1": 2,
  "1v1v1": 3,
  "1v1v1v1": 4,
  "2v2": 4,
};

export const MODES = ["1v1", "1v1v1", "1v1v1v1", "2v2"];

const ack = <T,>(event: string, ...args: any[]): Promise<T> =>
  new Promise((resolve) => socket.emit(event, ...args, (res: T) => resolve(res)));

export const getSocket = () => socket;
export const listBattles = () => ack<Battle[]>("battle:list");
export const getBattle = (id: string) => ack<Battle | null>("battle:get", id);
export const createBattle = (payload: { caseIds: string[]; mode: string; bakaMode: boolean }) =>
  ack<{ id?: string; error?: string }>("battle:create", payload);
export const joinBattle = (id: string) => ack<{ id?: string; error?: string }>("battle:join", id);
export const startBattle = (id: string) => ack<{ ok?: boolean; error?: string }>("battle:start", id);
export const addBot = (id: string) => ack<{ ok?: boolean; error?: string }>("battle:addBot", id);
export const kickPlayer = (id: string, slot: number) =>
  ack<{ ok?: boolean; error?: string }>("battle:kick", id, slot);
export const leaveBattle = (id: string) => socket.emit("battle:leave", id);
