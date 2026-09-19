export type PixelIconName =
  | "heart" | "star" | "jar" | "gift" | "ticket" | "coins" | "bag" | "dice" | "flame" | "trade"
  | "lens" | "chest" | "medal" | "swords" | "crown" | "book" | "scroll" | "chat" | "crystal" | "letter" | "clover" | "seal" | "mystery"
  | "goldticket" | "umbrella" | "shield" | "hourglass" | "tiara" | "calendar" | "trophy" | "drop" | "people";

// a 16 pixel drawing shown at a whole multiple of its size, so every pixel stays a sharp square
const PixelIcon = ({ name, size, className }: { name: PixelIconName; size: number; className?: string }) => (
  <img
    src={`/images/daisu/icons/${name}.png`}
    alt=""
    width={size}
    height={size}
    draggable={false}
    className={className}
    style={{ imageRendering: "pixelated" }}
  />
);

export default PixelIcon;
