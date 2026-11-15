import i18n from "../../i18n";
import type { VerifyResult } from "../../services/fair/FairServices";

// the scratch verifier rebuilds something different for each ticket, so each one reads back its own line; spots count from 1
export const scratchVerified = (v: VerifyResult) => {
  const payout = v.recomputedPayout;
  if (v.recomputedTicket === "treasure") {
    const board = (v.recomputedBoard || []).join(", ");
    const picks = (v.recomputedPicks || []).map((cell) => cell + 1).join(", ");
    return i18n.t("fair.verifiedScratchTreasure", { board, picks, payout });
  }
  if (v.recomputedTicket === "nine") {
    const spots = (v.recomputedSpots || []).map((s) => `${s.symbol} ${s.prize}`).join(", ");
    return i18n.t("fair.verifiedScratchNine", { lucky: (v.recomputedLucky || []).join(", "), multiplier: v.recomputedMultiplier, spots, payout });
  }
  return i18n.t("fair.verifiedScratchPocket", { cells: (v.recomputedCells || []).join(", "), payout });
};
