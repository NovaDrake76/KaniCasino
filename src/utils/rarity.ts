import Rarities from "../components/Rarities";

export const rarityColor = (rarity: string | number): string =>
  Rarities.find((r) => r.id.toString() === String(rarity))?.color || "#ffffff";
