import { BattleItem, BattlePlayer } from "../../../services/battles/BattleService";
import { useBattleRoomServices } from "./BattleRoom.services";

export interface CaseMeta {
  title: string;
  image: string;
  price: number;
  items: BattleItem[];
}

export interface CaseQueueItem {
  key: number;
  image?: string;
  title?: string;
  revealed: boolean;
  active: boolean;
}

export type ReelView =
  | { kind: "spin"; spinKey: string; pool: BattleItem[]; winner: BattleItem }
  | { kind: "settled"; item: BattleItem; color: string }
  | { kind: "idle"; image?: string; title?: string };

export interface WonItem {
  item: BattleItem;
  color: string;
}

export interface BattleColumn {
  key: number;
  player: BattlePlayer | null;
  isWinner: boolean;
  teamTag: string | null;
  showTotal: boolean;
  total: number;
  reel: ReelView;
  wonItems: WonItem[];
  canJoin: boolean;
  canAddBot: boolean;
  canKick: boolean;
  onJoin: () => void;
  onAddBot: () => void;
  onKick: () => void;
}

export interface WinnerBanner {
  winnerNames: string;
  teamSize: number;
  totalItems: number;
  value: number;
  perItemEach: boolean;
  bakaHint: string;
}

export interface TieView {
  players: BattlePlayer[];
  winner: BattlePlayer;
}

export type MyResult = "won" | "lost" | null;

export type BattleRoomViewProps = ReturnType<typeof useBattleRoomServices>;
