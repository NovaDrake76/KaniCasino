import type { LotteryPot } from "../../../services/lottery/LotteryService";
import type { Board } from "../../../services/leaderboard/LeaderboardService";

// loading until the first answer, failed when that one never came; a later failure keeps what is already held
export type FeedStatus = "loading" | "ready" | "failed";

export interface PotFeed {
  status: FeedStatus;
  // null once ready means there is no open draw
  pot: LotteryPot | null;
  // how far the device clock runs ahead of the server's, in ms
  skew: number;
}

export interface BoardFeed {
  status: FeedStatus;
  board: Board | null;
  skew: number;
}
