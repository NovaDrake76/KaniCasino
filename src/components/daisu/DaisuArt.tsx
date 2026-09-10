import { AnimatePresence, motion } from "framer-motion";
import Monetary from "../Monetary";
import type { Face, Pop } from "./Daisu.types";

interface Props {
  // how full the jar is, 0 to 1
  fill: number;
  face: Face;
  shaking?: boolean;
  // head and shoulders only, for the bubble
  bust?: boolean;
  className?: string;
  onJar?: () => void;
  onPoke?: () => void;
  pops?: Pop[];
  jarLabel?: string;
  pokeLabel?: string;
}

// one drawing per face; a face without its own drawing falls back to idle, so new art
// can land one expression at a time
const SPRITES: Partial<Record<Face, string>> = {
  idle: "/images/daisu/idle.webp",
};
const BUST = "/images/daisu/bust.webp";
const RATIO = "519 / 684";

// where the jar and the coins inside it sit on the drawing, as a share of its box.
// measured off the sketch; a new drawing that moves the jar changes these two lines
const GLASS = { left: 31.8, top: 52.9, width: 32.8, height: 22.2 };
const COINS = { left: 34.3, top: 56.1, width: 27.7, height: 17.5 };

const box = (r: typeof GLASS) => ({
  left: `${r.left}%`,
  top: `${r.top}%`,
  width: `${r.width}%`,
  height: `${r.height}%`,
});

// daisu holding the jar. the coins in the drawing are covered from the top by as much
// of the jar as has been taken, so the picture itself is the gauge
const DaisuArt = ({ fill, face, shaking, bust, className, onJar, onPoke, pops = [], jarLabel, pokeLabel }: Props) => {
  const level = Math.max(0, Math.min(1, fill));
  const src = bust ? BUST : SPRITES[face] || SPRITES.idle;

  if (bust) {
    return <img src={src} alt="" draggable={false} className={className} />;
  }

  return (
    <div className={`relative select-none ${className || ""}`} style={{ aspectRatio: RATIO }}>
      <div className={`h-full w-full ${face === "happy" ? "daisu-hop" : "daisu-bob"}`}>
        <img src={src} alt="" draggable={false} className="h-full w-full object-contain" />
        <button
          type="button"
          onClick={onPoke}
          aria-label={pokeLabel}
          className="absolute inset-0 cursor-pointer border-none bg-transparent p-0 hover:border-none focus:outline-none"
        />
        <button
          type="button"
          onClick={onJar}
          aria-label={jarLabel}
          style={box(GLASS)}
          className={`absolute cursor-pointer border-none bg-transparent p-0 hover:border-none focus:outline-none ${
            shaking ? "daisu-shake" : ""
          } ${level >= 1 ? "daisu-glow" : ""}`}
        >
          <span
            aria-hidden
            className="daisu-coins pointer-events-none absolute"
            style={{
              left: `${((COINS.left - GLASS.left) / GLASS.width) * 100}%`,
              top: `${((COINS.top - GLASS.top) / GLASS.height) * 100}%`,
              width: `${(COINS.width / GLASS.width) * 100}%`,
              height: `${(COINS.height / GLASS.height) * 100}%`,
              background: `linear-gradient(to bottom, rgba(20, 18, 37, 0.92) ${(1 - level) * 100}%, transparent ${(1 - level) * 100}%)`,
            }}
          />
        </button>
      </div>
      <AnimatePresence>
        {pops.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 0, y: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], y: -70, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, times: [0, 0.1, 0.7, 1] }}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-lg font-extrabold text-accent-gold drop-shadow"
            style={{ top: `${GLASS.top}%` }}
          >
            +<Monetary value={p.amount} />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default DaisuArt;
