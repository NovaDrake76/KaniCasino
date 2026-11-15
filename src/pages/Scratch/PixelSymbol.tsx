import { symbolSrc } from "./scratchTickets";

// the 32x32 pixel art, only ever at a whole multiple so every pixel stays square
const PixelSymbol = ({ name, size }: { name: string; size: 32 | 64 }) => (
  <img
    src={symbolSrc(name)}
    alt=""
    aria-hidden
    width={size}
    height={size}
    draggable={false}
    className="block shrink-0 select-none [image-rendering:pixelated]"
    style={{ width: size, height: size }}
  />
);

export default PixelSymbol;
