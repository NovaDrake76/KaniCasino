import { useCallback, useEffect, useRef } from "react";
import { STAMP_ALPHA, createSurface, isCommitted, isComplete, resetSurface, stamp, strokePoints, type Point, type Surface } from "../scratchSurface";
import { COIN_CURSOR, FLECK_COLORS, makeBrush, paintFoil } from "./foil";
import type { Fleck, ScratchCoatingProps } from "./ScratchCoating.types";

// the solid part of the brush; the feathered rim only softens the edge of what the grid already counts
const CORE = 0.75;
// the fleck canvas reaches this far past every edge, so flecks fly off the ticket rather than stopping at the foil
export const FLECK_PAD = 0.2;
const MAX_FLECKS = 90;
const FLECKS_PER_MOVE = 3;
const GRAVITY = 0.0009;
const FADE = 0.035;
// about ten ticks a second under a finger
const BUZZ_MS = 100;
const FADE_MS = 400;
// how long the foil takes to grow back over a press that lifted before its commit point
const RESTORE_MS = 160;
// the backing is sized once from the box at mount and never again, so a resize or a rotated phone never re-covers a scratch
const MAX_DPR = 2;
const FALLBACK_SIDE = 300;

const buzz = () => {
  try {
    navigator.vibrate?.(5);
  } catch {
    // a browser that refuses the vibration simply stays still
  }
};

export const useScratchCoating = ({ label, active, state, brush, threshold, onStart, onRub, onComplete, testId }: ScratchCoatingProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flecksRef = useRef<HTMLCanvasElement>(null);
  const surface = useRef<Surface>(createSurface({ threshold }));
  const brushImage = useRef<HTMLCanvasElement | null>(null);
  // the untouched foil, painted again over a press that never reached its commit point
  const pristine = useRef<HTMLCanvasElement | null>(null);
  const restoring = useRef(0);
  const last = useRef<Point | null>(null);
  // a coating with an onStart (a treasure spot) is only spent past its commit point; any other is spent from the first stroke
  const committed = useRef(!onStart);
  const worn = useRef(false);
  const box = useRef<DOMRect | null>(null);
  const done = useRef(false);
  const flecks = useRef<Fleck[]>([]);
  const frame = useRef(0);
  const buzzedAt = useRef(0);
  const calm = useRef(false);
  // the parent's callbacks change every render; the pointer handlers and the animation read the latest through this
  const calls = useRef({ onStart, onRub, onComplete });
  calls.current = { onStart, onRub, onComplete };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round((rect.width || FALLBACK_SIDE) * dpr));
    const height = Math.max(1, Math.round((rect.height || rect.width || FALLBACK_SIDE) * dpr));
    canvas.width = width;
    canvas.height = height;
    paintFoil(ctx, width, height, dpr, label);
    if (!committed.current) {
      const copy = document.createElement("canvas");
      copy.width = width;
      copy.height = height;
      copy.getContext("2d")?.drawImage(canvas, 0, 0);
      pristine.current = copy;
    }
    brushImage.current = makeBrush(brush * width, CORE);
    surface.current = createSurface({ aspect: height / width, threshold });
    const fleckCanvas = flecksRef.current;
    if (fleckCanvas) {
      fleckCanvas.width = Math.round(width * (1 + 2 * FLECK_PAD));
      fleckCanvas.height = Math.round(height * (1 + 2 * FLECK_PAD));
    }
    calm.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, [label, brush, threshold]);

  useEffect(() => {
    const raf = frame;
    const regrow = restoring;
    return () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(regrow.current);
    };
  }, []);

  const finishRestore = useCallback(() => {
    cancelAnimationFrame(restoring.current);
    restoring.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !pristine.current) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(pristine.current, 0, 0);
  }, []);

  // the press ended short of the commit point: the wear is forgotten at once and the foil grows back over a few frames
  const restore = useCallback(() => {
    resetSurface(surface.current);
    worn.current = false;
    last.current = null;
    const ctx = canvasRef.current?.getContext("2d");
    const image = pristine.current;
    if (!ctx || !image || calm.current) {
      finishRestore();
      return;
    }
    const from = performance.now();
    const grow = (now: number) => {
      const k = (now - from) / RESTORE_MS;
      if (k >= 1) {
        finishRestore();
        return;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, k);
      ctx.drawImage(image, 0, 0);
      ctx.restore();
      restoring.current = requestAnimationFrame(grow);
    };
    cancelAnimationFrame(restoring.current);
    restoring.current = requestAnimationFrame(grow);
  }, [finishRestore]);

  // the last pick went to another spot while this one was half rubbed: it was never spent, so it goes back to whole foil
  useEffect(() => {
    if (!active && !committed.current && worn.current) restore();
  }, [active, restore]);

  const drawFlecks = () => {
    const canvas = flecksRef.current;
    const ctx = canvas?.getContext("2d");
    const list = flecks.current;
    if (!canvas || !ctx) {
      list.length = 0;
      frame.current = 0;
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width / (1 + 2 * FLECK_PAD);
    const h = canvas.height / (1 + 2 * FLECK_PAD);
    for (const f of list) {
      f.x += f.vx;
      f.y += f.vy;
      f.vy += GRAVITY;
      f.life -= FADE;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.fillRect((f.x + FLECK_PAD) * w, (f.y + FLECK_PAD) * h, f.size, f.size * 0.6);
    }
    flecks.current = list.filter((f) => f.life > 0);
    frame.current = flecks.current.length ? requestAnimationFrame(drawFlecks) : 0;
  };

  const spray = (at: Point) => {
    for (let k = 0; k < FLECKS_PER_MOVE && flecks.current.length < MAX_FLECKS; k++) {
      flecks.current.push({
        x: at.x,
        y: at.y,
        vx: (Math.random() - 0.5) * 0.014,
        vy: -Math.random() * 0.012,
        life: 1,
        size: 3 + Math.random() * 4,
        color: FLECK_COLORS[Math.floor(Math.random() * FLECK_COLORS.length)],
      });
    }
    if (!frame.current) frame.current = requestAnimationFrame(drawFlecks);
  };

  const paint = (points: Point[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const image = brushImage.current;
    if (!canvas || !ctx || !image) return;
    const r = image.width / 2;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = STAMP_ALPHA;
    for (const p of points) ctx.drawImage(image, p.x * canvas.width - r, p.y * canvas.height - r);
    ctx.restore();
  };

  const at = (e: React.PointerEvent): Point => {
    const r = box.current || e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const release = (e: React.PointerEvent) => {
    last.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // the capture may already be gone; nothing to release
    }
  };

  // a lift before the commit point spends nothing, so the foil goes back the way it was
  const end = (e: React.PointerEvent) => {
    if (!committed.current && worn.current) restore();
    release(e);
  };

  const pointer = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active || done.current) return;
      e.preventDefault();
      if (restoring.current) finishRestore();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // a synthetic pointer has nothing to capture
      }
      box.current = e.currentTarget.getBoundingClientRect();
      last.current = at(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      const from = last.current;
      if (!from || !active || done.current) return;
      const points = strokePoints(from, at(e), brush, surface.current.aspect);
      if (!points.length) return;
      for (const p of points) stamp(surface.current, p.x, p.y, brush);
      paint(points);
      worn.current = true;
      const to = points[points.length - 1];
      last.current = to;
      calls.current.onRub();
      if (!calm.current) spray(to);
      if (e.pointerType === "touch" && Date.now() - buzzedAt.current >= BUZZ_MS) {
        buzzedAt.current = Date.now();
        buzz();
      }
      if (!committed.current && isCommitted(surface.current)) {
        if (calls.current.onStart && !calls.current.onStart()) {
          restore();
          release(e);
          return;
        }
        committed.current = true;
      }
      if (committed.current && isComplete(surface.current)) {
        done.current = true;
        last.current = null;
        calls.current.onComplete();
      }
    },
    onPointerUp: end,
    onPointerCancel: end,
  };

  const wiped = state === "wiping" || state === "wiped";
  return {
    canvasRef,
    flecksRef,
    pointer,
    testId: testId || "scratch-coating",
    style: {
      cursor: active ? COIN_CURSOR : "default",
      opacity: state === "faded" ? 0 : 1,
      clipPath: wiped ? "inset(0 0 0 100%)" : "inset(0 0 0 0)",
      transition: `opacity ${FADE_MS}ms ease-out, clip-path 300ms ease-in`,
      pointerEvents: state === "covered" ? ("auto" as const) : ("none" as const),
      touchAction: "none" as const,
    },
  };
};
