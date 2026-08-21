// shared playing-card display logic. lives here rather than in a page because three games
// draw the same card now, and hilo was already reaching across into blackjack's folder.
//
// display encoding: card 0..51, rank = card % 13 (0 = ace, 9..12 = ten/J/Q/K),
// suit = floor(card / 13). this mirrors backend/utils/blackjackMath.js.
//
// poker uses a different encoding on purpose (rank 0 = two, 12 = ace, because the ace is
// high there), so it converts with pokerToDisplay before drawing anything.

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

// poker rank 0 is the deuce and 12 is the ace; the display scale puts the ace at 0
export const pokerToDisplay = (card: number) =>
  Math.floor(card / 13) * 13 + ((card % 13) + 1) % 13;

// face cards carry touhou court art: [spades, hearts, diamonds, clubs] per rank
const FACE_ART: Record<number, [string, string, string, string]> = {
  10: ["youmu", "sakuya", "sanae", "cirno"],
  11: ["yuyuko", "flandre", "marisa", "koishi"],
  12: ["yukari", "remilia", "reimu", "satori"],
};

export function faceArt(card: number) {
  const art = FACE_ART[rankOf(card)];
  return art ? { src: `/images/cards/${art[suitOf(card)]}.webp`, name: art[suitOf(card)] } : null;
}
