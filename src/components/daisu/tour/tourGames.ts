import type { PickGame } from "../../../services/daisu/DaisuService";
import { GAME_ART, GAME_NAME_KEYS, GAME_PATHS } from "../potMath";

export interface TourGameInfo {
  key: string;
  path: string;
  art: string;
  nameKey: string;
}

const picked = (key: PickGame): TourGameInfo => ({ key, path: GAME_PATHS[key], art: GAME_ART[key], nameKey: GAME_NAME_KEYS[key] });

// the eight betting games; crash and coin flip are live rooms, so the pot never picks them
export const TOUR_GAMES: TourGameInfo[] = [
  picked("slots"),
  { key: "crash", path: "/crash", art: "/images/crash/idle.gif", nameKey: "nav.crash" },
  picked("blackjack"),
  picked("plinko"),
  picked("dice"),
  picked("mines"),
  { key: "coinflip", path: "/coinflip", art: "/images/coinHeads.webp", nameKey: "nav.coinFlip" },
  picked("hilo"),
];

export const tourGame = (key: string | null) => TOUR_GAMES.find((g) => g.key === key) || null;
