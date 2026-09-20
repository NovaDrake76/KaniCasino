import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Monetary from "../Monetary";
import { ART_HEIGHT, ART_WIDTH, JAR } from "./daisuParts";
import { EXPRESSIONS, jarStage, type Expression } from "./daisuFace";
import { useTalking } from "./speechStore";
import type { Pop, Run } from "./Daisu.types";

interface Props {
  // how full the jar is, 0 to 1
  fill: number;
  expression: Expression;
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
  pokeLocked?: boolean;
}

const PART = (name: string) => `/images/daisu/parts/${name}.webp`;
const BUST = "/images/daisu/bust.webp";
const RATIO = `${ART_WIDTH} / ${ART_HEIGHT}`;

// how long the mouth holds each shape while she talks
const FLAP_MS = 110;

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

const Layer = ({ part, hidden, className, style }: { part: string; hidden?: boolean; className?: string; style?: CSSProperties }) => (
  <img
    src={PART(part)}
    alt=""
    draggable={false}
    aria-hidden
    style={style}
    className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${hidden ? "invisible" : ""} ${className || ""}`}
  />
);

// the jar shakes and glows about its own middle, not the middle of the drawing it sits in
const JAR_PIVOT = { transformOrigin: `${JAR.left + JAR.width / 2}% ${JAR.top + JAR.height / 2}%` };

// the mouth she is wearing this frame: closed, then one of her expression's open shapes
const mouthNow = (expression: Expression, talking: boolean, frame: number) => {
  const look = EXPRESSIONS[expression];
  if (!talking || frame % 2 === 0) return look.rest;
  return look.talk[Math.floor(frame / 2) % look.talk.length];
};

// daisu holding the jar, drawn as stacked parts: the body, one of five jars, her eyes and
// her mouth. how full the jar is picks its drawing, so the picture itself is the gauge
const DaisuArt = ({ fill, expression, shaking, bust, className, onJar, onPoke, pops = [], run, settleMs, jarLabel, pokeLabel, pokeLocked }: Props) => {
  const level = Math.max(0, Math.min(1, fill));
  const stage = jarStage(level);
  const talking = useTalking();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!talking) {
      setFrame(0);
      return;
    }
    const timer = window.setInterval(() => setFrame((f) => f + 1), FLAP_MS);
    return () => window.clearInterval(timer);
  }, [talking]);

  if (bust) {
    return <img src={BUST} alt="" draggable={false} className={className} />;
  }

  const look = EXPRESSIONS[expression];
  const mouth = mouthNow(expression, talking, frame);
  // the next jar is mounted unseen, so the drawing never blinks as the pot fills past a quarter
  const jars = [...new Set([stage, Math.min(4, stage + 1)])];

  return (
    <div className={`relative select-none ${className || ""}`} style={{ aspectRatio: RATIO }}>
      <div className={`relative h-full w-full ${expression === "smug" ? "daisu-hop" : "daisu-bob"}`}>
        <Layer part="base" />
        {jars.map((i) => (
          <Layer
            key={i}
            part={`jar-${i}`}
            hidden={i !== stage}
            style={JAR_PIVOT}
            className={`${shaking ? "daisu-shake" : ""} ${level >= 1 ? "daisu-glow" : ""}`}
          />
        ))}
        {(["default", "smug", "sharp"] as const).map((eyes) => (
          <Layer key={eyes} part={`eyes-${eyes}`} hidden={eyes !== look.eyes} />
        ))}
        {(["closed", "open", "wide"] as const).map((shape) => (
          <Layer key={shape} part={`mouth-${shape}`} hidden={shape !== mouth} />
        ))}
        <button
          type="button"
          onClick={onPoke}
          aria-label={pokeLabel}
          disabled={pokeLocked}
          className="absolute inset-0 cursor-pointer border-none bg-transparent p-0 hover:border-none focus:outline-none disabled:cursor-default"
        />
        <button
          type="button"
          onClick={onJar}
          aria-label={jarLabel}
          data-tour="daisu-jar"
          style={{ left: `${JAR.left}%`, top: `${JAR.top}%`, width: `${JAR.width}%`, height: `${JAR.height}%` }}
          className="absolute cursor-pointer border-none bg-transparent p-0 hover:border-none focus:outline-none"
        />
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
            style={{ top: `${JAR.top}%`, left: `calc(50% - 5rem + ${p.x}px)` }}
          >
            +<Monetary value={p.amount} />
          </motion.span>
        ))}
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: `${JAR.top + JAR.height + 2}%` }}>
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
