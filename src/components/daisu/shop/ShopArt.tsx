import PixelIcon, { PixelIconName } from "../PixelIcon";

const ART: Record<string, PixelIconName> = {
  collectionBook: "book",
  tradersLicense: "scroll",
  chatPass: "chat",
  predictionPass: "crystal",
  affiliateCard: "letter",
  giftCharm: "clover",
  merchantSeal: "seal",
};

// one picture per item; sizes are rounded to a multiple of 16 so the pixels stay square
const ShopArt = ({ item, size }: { item: string; size: number }) => (
  <PixelIcon name={ART[item] || "mystery"} size={Math.max(16, Math.round(size / 16) * 16)} />
);

export default ShopArt;
