import Rarities from "../components/Rarities";
import i18n from "../i18n";

export const rarityColor = (rarity: string | number): string =>
  Rarities.find((r) => r.id.toString() === String(rarity))?.color || "#ffffff";

// resolved per call, not per module: Rarities is built once at import and would freeze
// whatever language the page opened in
export const rarityName = (rarity: string | number): string => {
  const found = Rarities.find((r) => r.id.toString() === String(rarity));
  return found ? i18n.t(`rarity.${found.id}`) : "";
};

const RARITY_ABBR: Record<string, string> = {
  "1": "C",
  "2": "R",
  "3": "E",
  "4": "UR",
  "5": "UN",
};

export const rarityAbbr = (rarity: string | number): string =>
  RARITY_ABBR[String(rarity)] || "?";
