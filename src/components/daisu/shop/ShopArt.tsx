import PixelIcon, { PixelIconName } from "../PixelIcon";

const ART: Record<string, PixelIconName> = {
  spyglass: "lens",
  collectionBook: "book",
  tradersLicense: "scroll",
  chatPass: "chat",
  predictionPass: "crystal",
  affiliateCard: "letter",
  giftCharm: "clover",
  merchantSeal: "seal",
  goldenTicket: "goldticket",
  rainCoat: "umbrella",
  luckyPencil: "pencil",
  pocketNotebook: "notebook",
  readingLamp: "lamp",
  coffeeMug: "mug",
  abacus: "abacus",
  fortuneCat: "cat",
  studyDesk: "desk",
  metronome: "metronome",
  hourglass: "hourglass",
  globe: "globe",
  telescope: "telescope",
  goldCat: "goldcat",
  libraryCard: "card",
  compass: "compass",
  crystalSkull: "skull",
  daisuDiary: "diary",
  starChart: "starchart",
  goldenAbacus: "goldabacus",
  observatory: "observatory",
  philosopherStone: "stone",
};

// a charm wears its game's own art where the game has one, a pixel icon otherwise
const GAME_ART: Record<string, string> = {
  dice: "/images/dice.svg",
  plinko: "/images/plinko.svg",
  blackjack: "/images/blackjack.svg",
  mines: "/images/mines.svg",
  hilo: "/images/hilo.svg",
  slots: "/images/slot/wild.webp",
  coinflip: "/images/coinHeads.webp",
};
const GAME_ICON: Record<string, PixelIconName> = { crash: "flame", cases: "chest", battles: "swords" };

// one picture per item; sizes are rounded to a multiple of 16 so the pixels stay square
const ShopArt = ({ item, game, size }: { item: string; game?: string; size: number }) => {
  const px = Math.max(16, Math.round(size / 16) * 16);
  if (game && GAME_ART[game]) return <img src={GAME_ART[game]} alt="" width={px} height={px} draggable={false} className="object-contain" />;
  return <PixelIcon name={ART[item] || (game && GAME_ICON[game]) || "mystery"} size={px} />;
};

export default ShopArt;
