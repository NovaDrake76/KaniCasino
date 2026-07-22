// pure card logic, mirroring backend/utils/blackjackMath.js exactly:
// card 0..51, rank = card % 13 (0 = ace, 9..12 = ten/J/Q/K), suit = floor(card / 13)

export const RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"] as const;
export type SuitName = (typeof SUIT_NAMES)[number];

export const rankOf = (card: number) => card % 13;
export const suitOf = (card: number) => Math.floor(card / 13);
export const rankLabel = (card: number) => RANK_LABELS[rankOf(card)];
export const suitName = (card: number): SuitName => SUIT_NAMES[suitOf(card)];
export const isRedSuit = (card: number) => suitOf(card) === 1 || suitOf(card) === 2;

const RANK_WORDS = ["ace", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king"];
export const cardAria = (card: number) => `${RANK_WORDS[rankOf(card)]} of ${suitName(card)}`;

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
