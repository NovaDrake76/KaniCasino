import { rangeFill } from "./ballColors";
import type { BallTone } from "./Lottery.types";

// rows sit on surface-nav, so a number that missed is one step lighter than its row rather than the same fill
const TONES: Record<BallTone, string> = {
  plain: "bg-surface-hover text-ink",
  drawn: "bg-accent-gold text-surface-deep",
  hit: "bg-accent-gold text-surface-deep",
  miss: "bg-surface-raised text-ink-muted",
  pending: "bg-surface-nav text-ink-faint",
};

const SIZES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-lg short:h-10 short:w-10 short:text-base",
};

interface BallProps {
  n: number | null;
  tone?: BallTone;
  size?: keyof typeof SIZES;
  // "drum" is the machine's ball: coloured by range, the number on a white disc, a gold ring when it is a hit
  look?: "flat" | "drum";
  drop?: boolean;
}

const BASE = "inline-flex shrink-0 items-center justify-center rounded-full tabular-nums";
const RING = "ring-2 ring-accent-gold ring-offset-2 ring-offset-surface-nav";

const DrumBall = ({ n, tone, size, drop }: Required<Omit<BallProps, "look">>) => (
  <span
    data-testid="ball"
    data-tone={tone}
    data-look="drum"
    className={`${BASE} font-extrabold ${SIZES[size]} ${n == null ? "bg-[#100E1F] text-ink-muted" : rangeFill(n)} ${
      tone === "hit" ? RING : ""
    } ${drop ? "motion-safe:animate-ball-drop" : ""}`}
  >
    <span className={`flex h-[62%] w-[62%] items-center justify-center rounded-full ${n == null ? "" : "bg-white text-surface-deep"}`}>{n ?? "?"}</span>
  </span>
);

// one lottery ball: a filled circle, never an outline
const Ball = ({ n, tone = "plain", size = "md", look = "flat", drop = false }: BallProps) =>
  look === "drum" ? (
    <DrumBall n={n} tone={tone} size={size} drop={drop} />
  ) : (
    <span data-testid="ball" data-tone={tone} className={`${BASE} font-bold ${SIZES[size]} ${TONES[tone]}`}>
      {n ?? "?"}
    </span>
  );

export const BallRow = ({ balls, size = "md" }: { balls: { n: number | null; tone: BallTone }[]; size?: keyof typeof SIZES }) => (
  <span className="flex items-center gap-1.5">
    {balls.map((ball, i) => (
      <Ball key={i} n={ball.n} tone={ball.tone} size={size} />
    ))}
  </span>
);

export default Ball;
