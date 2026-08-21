// blackjack scoring. the card display helpers moved to components/game/cards.ts once a
// third game needed them; they are re-exported here so nothing that already imported them
// from this file had to change.
export {
  RANK_LABELS,
  SUIT_NAMES,
  rankOf,
  suitOf,
  rankLabel,
  suitName,
  isRedSuit,
  cardAria,
  faceArt,
} from "../../components/game/cards";
export type { SuitName } from "../../components/game/cards";

import { rankOf } from "../../components/game/cards";

export function cardValue(card: number) {
  const rank = rankOf(card);
  if (rank === 0) return 11;
  if (rank >= 9) return 10;
  return rank + 1;
}

export function handTotal(cards: number[]) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const value = cardValue(card);
    total += value;
    if (value === 11) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

// soft hands show both readings ("7/17") until they harden, stand, or reach 21
export function totalLabel(cards: number[]) {
  const { total, soft } = handTotal(cards);
  if (soft && total !== 21) return `${total - 10}/${total}`;
  return String(total);
}

export const OUTCOME_LABELS: Record<string, string> = {
  blackjack: "Blackjack!",
  win: "You win",
  push: "Push",
  lose: "Dealer wins",
};

export const outcomeLabel = (outcome: string | null | undefined) =>
  (outcome && OUTCOME_LABELS[outcome]) || "";
