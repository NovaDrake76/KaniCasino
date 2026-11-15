import { useEffect, useRef } from "react";
import { DrumProps, DrumSpeed } from "./Drum.types";
import { DrumState, SIZE, createDrum, settle, step, syncDrum } from "./drumPhysics";
import { paintDrum } from "./drumPaint";

// how fast the wall turns, in radians a second: a lazy roll on sale, brisk in the last minute, flat out for the draw
export const SPINS: Record<DrumSpeed, number> = { open: 0.7, closed: 2.6, drawing: 3.4 };
// one frame never moves the drum further than this, so a tab that comes back after an hour does not fling the balls
export const MAX_FRAME_S = 0.032;
// a new speed is reached in about half a second rather than in one jump
const SPIN_EASE = 4;
const MAX_DPR = 2;

// seconds since the last frame, held to MAX_FRAME_S; the first frame after a start moves nothing
export const frameSeconds = (last: number, now: number) => (last ? Math.min(MAX_FRAME_S, Math.max(0, (now - last) / 1000)) : 0);

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const useDrum = ({ numbers, speed, label }: DrumProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drum = useRef<DrumState | null>(null);
  if (!drum.current) drum.current = settle(createDrum(numbers));
  const target = useRef(SPINS[speed]);
  target.current = SPINS[speed];
  const redraw = useRef<() => void>(() => undefined);

  // the parent hands a new array every render, so the drum follows what is in it, not which array it is
  const key = numbers.join(",");
  useEffect(() => {
    if (!drum.current) return;
    syncDrum(drum.current, key ? key.split(",").map(Number) : []);
    redraw.current();
  }, [key]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const state = drum.current;
    if (!canvas || !ctx || !state) return;
    const still = reducedMotion();
    let font = getComputedStyle(canvas).fontFamily || "sans-serif";
    let spin = target.current;
    let frame = 0;
    let last = 0;
    let onScreen = typeof IntersectionObserver === "undefined";
    let tabShown = document.visibilityState !== "hidden";
    let alive = true;

    const paint = () => paintDrum(ctx, state, canvas.width / SIZE, font);

    const fit = () => {
      const px = Math.round((canvas.clientWidth || SIZE / 2) * Math.min(MAX_DPR, window.devicePixelRatio || 1));
      if (px > 0 && px !== canvas.width) {
        canvas.width = px;
        canvas.height = px;
      }
      paint();
    };

    const tick = (now: number) => {
      const dt = frameSeconds(last, now);
      last = now;
      spin += (target.current - spin) * Math.min(1, dt * SPIN_EASE);
      step(state, dt, spin);
      paint();
      frame = requestAnimationFrame(tick);
    };

    // nobody watching, nothing to draw: the loop runs only while the drum is on screen in a visible tab
    const gate = () => {
      const run = !still && onScreen && tabShown;
      if (run && !frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      } else if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    redraw.current = () => {
      if (still) settle(state);
      if (still || !frame) paint();
    };

    const onVisibility = () => {
      tabShown = document.visibilityState !== "hidden";
      gate();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const seen =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            onScreen = entries.some((e) => e.isIntersecting);
            gate();
          });
    seen?.observe(canvas);

    const sized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    sized?.observe(canvas);
    if (!sized) window.addEventListener("resize", fit);

    // the numbers are drawn in the page's font, which may still be on its way when the first frame is painted
    document.fonts?.ready
      .then(() => {
        if (!alive) return;
        font = getComputedStyle(canvas).fontFamily || font;
        paint();
      })
      .catch(() => undefined);

    fit();
    gate();

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      frame = 0;
      redraw.current = () => undefined;
      document.removeEventListener("visibilitychange", onVisibility);
      seen?.disconnect();
      sized?.disconnect();
      if (!sized) window.removeEventListener("resize", fit);
    };
  }, []);

  return { canvasRef, size: SIZE, label };
};
