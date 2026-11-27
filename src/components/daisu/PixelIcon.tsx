export type PixelIconName =
  | "heart" | "star" | "jar" | "gift" | "ticket" | "coins" | "bag" | "dice" | "flame" | "trade"
  | "lens" | "chest" | "medal" | "swords" | "crown" | "book" | "scroll" | "chat" | "crystal" | "letter" | "clover" | "seal" | "mystery"
  | "goldticket" | "umbrella" | "stopwatch" | "hourglass" | "calendar" | "trophy" | "drop" | "people"
  | "pencil" | "notebook" | "lamp" | "mug" | "abacus" | "cat" | "desk" | "metronome" | "globe" | "telescope"
  | "goldcat" | "card" | "compass" | "skull" | "diary" | "starchart" | "goldabacus" | "observatory" | "stone";

// bump when a drawing changes: the files are cached for a long time under the same name
const ICON_VERSION = 2;

// a 32 pixel drawing: sharp squares at a whole multiple of its size, smoothed at any size in between
const PixelIcon = ({ name, size, className }: { name: PixelIconName; size: number; className?: string }) => (
  <img
    src={`/images/daisu/icons/${name}.png?v=${ICON_VERSION}`}
    alt=""
    width={size}
    height={size}
    draggable={false}
    className={className}
    style={{ imageRendering: size % 32 === 0 ? "pixelated" : "auto" }}
  />
);

export default PixelIcon;
