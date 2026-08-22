export type FanCardStyleId = "pinned" | "notice" | "funk" | "agit" | "vhs" | "foil";

export interface FanCardData {
  // the character the board is for
  name: string;
  image: string;
  rarity: string;
  // the player holding it
  holder: string;
  level: number;
  count: number;
  second: number;
  fans: number;
  since: number;
  // the pinned panel is the only style that shows the player's own words
  desc: string;
}
