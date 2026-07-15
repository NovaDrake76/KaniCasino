import Rarities from "../components/Rarities";

export const rarityColor = (rarity: string | number): string =>
  Rarities.find((r) => r.id.toString() === String(rarity))?.color || "#ffffff";

export const rarityName = (rarity: string | number): string =>
  Rarities.find((r) => r.id.toString() === String(rarity))?.name || "";

const RARITY_ABBR: Record<string, string> = {
  "1": "C",
  "2": "R",
  "3": "E",
  "4": "UR",
  "5": "UN",
};

export const rarityAbbr = (rarity: string | number): string =>
  RARITY_ABBR[String(rarity)] || "?";
