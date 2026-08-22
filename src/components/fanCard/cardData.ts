import { FanBoard, FanRank } from "../../services/fandom/FandomService";
import { FanCardData } from "./cardTypes";

export const yearOf = (value?: string | null) => {
  const year = value ? new Date(value).getFullYear() : NaN;
  return Number.isFinite(year) ? year : new Date().getFullYear();
};

// the board page already holds every number the card needs, including the runner-up
export const cardFromBoard = (board: FanBoard, desc = ""): FanCardData | null =>
  board.top
    ? {
        name: board.name,
        image: board.image,
        rarity: board.rarity,
        holder: board.top.username,
        level: board.top.level,
        count: board.topCount,
        second: board.secondCount,
        fans: board.fanCount,
        since: yearOf(board.top.since),
        desc,
      }
    : null;

// the cards come with the crown: a runner-up has nothing to share
export const canShareCard = (fanRank?: FanRank | null) => fanRank?.rank === 1;

// the profile works off the standing the sweep left on the player, which is why that
// carries the runner-up count and the pin date
export const cardFromStanding = (
  fanRank: FanRank | null | undefined,
  holder: string,
  level: number,
  desc = ""
): FanCardData | null =>
  fanRank
    ? {
        name: fanRank.name,
        image: fanRank.image,
        rarity: fanRank.rarity,
        holder,
        level,
        count: fanRank.count,
        second: fanRank.second || 0,
        fans: fanRank.fans,
        since: yearOf(fanRank.since),
        desc,
      }
    : null;
