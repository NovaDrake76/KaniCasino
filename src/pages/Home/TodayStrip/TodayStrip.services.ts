import type { MouseEvent } from "react";
import i18n from "../../../i18n";
import { BoardMe } from "../../../services/leaderboard/LeaderboardService";
import { useHomeBoard, useHomePot } from "../HomeFeed/HomeFeed.context";
import { BoardFeed, PotFeed } from "../HomeFeed/HomeFeed.types";
import { LEADERBOARD_ID } from "../Leaderboard/Leaderboard.services";
import { CardData, TodayCard, YouChip } from "./TodayStrip.types";

const LOADING: CardData = { kind: "loading" };
const EMPTY: CardData = { kind: "empty" };

const ready = (amount: number, endsAtIso: string, skew: number): CardData => {
  const endsAt = Date.parse(endsAtIso);
  return Number.isFinite(endsAt) ? { kind: "ready", amount, endsAt, skew } : EMPTY;
};

export const potCard = (feed: PotFeed): CardData => {
  if (feed.status === "loading") return LOADING;
  return feed.pot ? ready(feed.pot.jackpot, feed.pot.drawAt, feed.skew) : EMPTY;
};

export const boardCard = (feed: BoardFeed): CardData => {
  if (feed.status === "loading") return LOADING;
  return feed.board ? ready(feed.board.pool, feed.board.endsAt, feed.skew) : EMPTY;
};

// the board already answers a null rank for an unverified or limited account; the flags are read too so that never leaks a chip.
// a phone has no room for the word, so there the chip is the place alone
export const youChip = (me: BoardMe | null | undefined): YouChip | null =>
  me && typeof me.rank === "number" && !me.needsVerify && !me.limited ? { full: `${i18n.t("leaderboard.you")} #${me.rank}`, short: `#${me.rank}` } : null;

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const useTodayStrip = () => {
  const pot = useHomePot();
  const board = useHomeBoard();

  // the category bar's way: the section carries scroll-mt, so the sticky bar never covers its heading
  const goToLeaderboard = (event: MouseEvent<HTMLAnchorElement>) => {
    const node = document.getElementById(LEADERBOARD_ID);
    if (!node) return;
    event.preventDefault();
    node.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  };

  const lottery: TodayCard = { name: i18n.t("lottery.lottery"), data: potCard(pot) };
  const leaderboard: TodayCard = { name: i18n.t("leaderboard.title"), data: boardCard(board) };

  return {
    lottery,
    leaderboard,
    you: youChip(board.board && board.board.me),
    lotteryTo: "/lottery",
    leaderboardHref: `#${LEADERBOARD_ID}`,
    goToLeaderboard,
  };
};
