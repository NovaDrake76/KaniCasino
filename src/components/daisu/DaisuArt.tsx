import { AnimatePresence, motion } from "framer-motion";
import Monetary from "../Monetary";
import type { Face, Pop, Run } from "./Daisu.types";

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
  // the clicks not sent yet, counted up under the jar, and the pause that sends them
  run?: Run | null;
  settleMs?: number;
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

const RUN_COLOR: Record<Run["state"], string> = {
  open: "text-accent-gold",
  sending: "text-accent-gold animate-pulse",
  sent: "text-green-400",
  failed: "text-red-500",
};

// a sent run floats off toward the wallet, a failed one shakes and fades where it is
const runMotion = (state: Run["state"]) => {
  if (state === "sent") return { animate: { opacity: [1, 1, 0], y: -28 }, transition: { duration: 1.5, times: [0, 0.5, 1] } };
  if (state === "failed") return { animate: { opacity: [1, 1, 0], x: [0, -6, 6, -4, 4, 0] }, transition: { duration: 1.5 } };
  return { animate: { opacity: 1, y: 0, x: 0 }, transition: { duration: 0.15 } };
};

const box = (r: typeof GLASS) => ({
  left: `${r.left}%`,
  top: `${r.top}%`,
  width: `${r.width}%`,
  height: `${r.height}%`,
});

// daisu holding the jar. the coins in the drawing are covered from the top by as much
// of the jar as has been taken, so the picture itself is the gauge
const DaisuArt = ({ fill, face, shaking, bust, className, onJar, onPoke, pops = [], run, settleMs, jarLabel, pokeLabel }: Props) => {
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
            className="pointer-events-none absolute w-40 text-center text-lg font-extrabold text-accent-gold drop-shadow"
            style={{ top: `${GLASS.top}%`, left: `calc(50% - 5rem + ${p.x}px)` }}
          >
            +<Monetary value={p.amount} />
          </motion.span>
        ))}
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: `${GLASS.top + GLASS.height + 2}%` }}>
        <AnimatePresence>
          {run && (
            <motion.div
              key={run.id}
              data-run={run.state}
              initial={{ opacity: 0, y: 6 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-stretch"
              {...runMotion(run.state)}
            >
              <motion.span
                key={run.amount}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`bg-surface-nav/90 px-2 py-0.5 text-base font-extrabold ${RUN_COLOR[run.state]}`}
              >
                +<Monetary value={run.amount} />
              </motion.span>
              {run.state === "open" && settleMs ? (
                <span
                  key={run.lastClickAt}
                  aria-hidden
                  className="daisu-countdown h-0.5 bg-accent-gold"
                  style={{ animationDuration: `${settleMs}ms` }}
                />
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DaisuArt;
