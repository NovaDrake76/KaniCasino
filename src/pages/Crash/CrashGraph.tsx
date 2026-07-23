import { useEffect, useRef } from "react";
import { multiplierAt, elapsedFor, axisRange, pointFor, yTicks, xTicks } from "./crashCurve";

interface CrashGraphProps {
    gameStarted: boolean;
    gameEnded: boolean;
    multiplier: number;
    crashPoint: number | null;
    up: string;
    idle: string;
    falling: string;
}

type Phase = "idle" | "running" | "crashed";

interface Star {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    r: number;
    rot: number;
    spin: number;
    color: string;
}

interface Dot {
    x: number;
    y: number;
    r: number;
    v: number;
    color: string;
}

const GOLD = "#FFCC00"; // accent-gold, Marisa's color
const RED = "#EF4444"; // red-500, matches the crashed banner
const GRID = "#2A2840"; // line token
const LABEL = "#84819A"; // ink-muted token
const DOT_COLORS = ["#4B69FF", "#8847FF"]; // faint danmaku in the rarity blues
const PAD_L = 44;
const PAD_R = 18;
const PAD_T = 14;
const PAD_B = 22;
const SPRITE_W = 80;

const drawStar = (ctx: CanvasRenderingContext2D, s: Star) => {
    const alpha = 1 - s.life / s.ttl;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.globalAlpha = Math.max(alpha, 0) * 0.9;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? s.r : s.r * 0.42;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

const CrashGraph: React.FC<CrashGraphProps> = ({ gameStarted, gameEnded, multiplier, crashPoint, up, idle, falling }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const spriteRef = useRef<HTMLImageElement>(null);

    const phase: Phase = gameStarted && !gameEnded ? "running" : gameEnded && crashPoint ? "crashed" : "idle";
    const phaseRef = useRef<Phase>(phase);
    phaseRef.current = phase;
    const crashRef = useRef<number | null>(crashPoint);
    crashRef.current = crashPoint;

    // the anchor pins the local clock to the server's multiplier, so the curve
    // animates at display refresh rate while every 80ms tick re-trues it
    const anchorRef = useRef<number>(performance.now());
    const starsRef = useRef<Star[]>([]);
    const dotsRef = useRef<Dot[]>([]);
    const tipRef = useRef({ x: PAD_L, y: 0, angle: 0 });

    useEffect(() => {
        if (gameStarted && !gameEnded) {
            anchorRef.current = performance.now() - elapsedFor(multiplier) * 1000;
        }
    }, [multiplier, gameStarted, gameEnded]);

    // sprite state is imperative: src/transition/opacity change per phase, and the
    // fall is a one-shot css transition from wherever the tip was
    useEffect(() => {
        const img = spriteRef.current;
        const wrap = wrapRef.current;
        if (!img || !wrap) return;
        if (phase === "running") {
            img.src = up;
            img.style.transition = "none";
            img.style.opacity = "1";
        } else if (phase === "crashed") {
            const t = tipRef.current;
            img.src = falling;
            img.style.transition = "transform 1.1s ease-in, opacity 1.1s ease-in";
            img.style.transform = `translate(${t.x - SPRITE_W / 2}px, ${wrap.clientHeight + 40}px)`;
            img.style.opacity = "0";
        } else {
            img.src = idle;
            img.style.transition = "none";
            img.style.opacity = "1";
        }
    }, [phase, up, idle, falling]);

    useEffect(() => {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        const sprite = spriteRef.current;
        if (!wrap || !canvas || !sprite) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const resize = () => {
            canvas.width = Math.max(wrap.clientWidth, 1) * dpr;
            canvas.height = Math.max(wrap.clientHeight, 1) * dpr;
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(wrap);

        if (!dotsRef.current.length) {
            dotsRef.current = Array.from({ length: 26 }, () => ({
                x: Math.random(),
                y: Math.random(),
                r: 1 + Math.random() * 2,
                v: 6 + Math.random() * 14,
                color: DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
            }));
        }

        let last = performance.now();
        let raf = 0;

        const drawAxes = (w: number, h: number, elapsed: number, m: number) => {
            const range = axisRange(elapsed, m);
            ctx.strokeStyle = GRID;
            ctx.fillStyle = LABEL;
            ctx.lineWidth = 1;
            ctx.font = "10px Montserrat, sans-serif";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            for (const v of yTicks(range.yMax)) {
                const { y } = pointFor(0, v, range, w, h);
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.moveTo(PAD_L, PAD_T + y);
                ctx.lineTo(PAD_L + w, PAD_T + y);
                ctx.stroke();
                ctx.fillText(`${v}x`, PAD_L - 6, PAD_T + y);
            }
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            for (const v of xTicks(range.xMax)) {
                const { x } = pointFor(v, 1, range, w, h);
                ctx.fillText(`${v}s`, PAD_L + x, PAD_T + h + 6);
            }
            ctx.globalAlpha = 1;
            return range;
        };

        const drawCurve = (w: number, h: number, elapsed: number, m: number, color: string) => {
            const range = drawAxes(w, h, elapsed, m);
            const steps = 64;
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const t = (elapsed * i) / steps;
                const p = pointFor(t, Math.min(multiplierAt(t), m), range, w, h);
                ctx.lineTo(PAD_L + p.x, PAD_T + p.y);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            ctx.shadowColor = color;
            ctx.shadowBlur = 14;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // translucent fill under the curve, like the reference games
            const tip = pointFor(elapsed, m, range, w, h);
            ctx.lineTo(PAD_L + tip.x, PAD_T + h);
            ctx.lineTo(PAD_L, PAD_T + h);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + h);
            grad.addColorStop(0, `${color}3D`);
            grad.addColorStop(1, `${color}05`);
            ctx.fillStyle = grad;
            ctx.fill();

            const prev = pointFor(elapsed * 0.97, Math.min(multiplierAt(elapsed * 0.97), m), range, w, h);
            tipRef.current = {
                x: PAD_L + tip.x,
                y: PAD_T + tip.y,
                angle: Math.max(Math.min(Math.atan2(tip.y - prev.y, tip.x - prev.x), 0), -1.1),
            };
        };

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame);
            const dt = Math.min((now - last) / 1000, 0.1);
            last = now;

            const W = wrap.clientWidth;
            const H = wrap.clientHeight;
            const w = W - PAD_L - PAD_R;
            const h = H - PAD_T - PAD_B;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);

            // the danmaku drift runs in every phase, faint enough to never compete
            for (const d of dotsRef.current) {
                d.y -= (d.v * dt) / H;
                if (d.y < -0.02) {
                    d.y = 1.02;
                    d.x = Math.random();
                }
                ctx.globalAlpha = 0.14;
                ctx.fillStyle = d.color;
                ctx.beginPath();
                ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            const currentPhase = phaseRef.current;
            if (currentPhase === "running") {
                const elapsed = Math.max((now - anchorRef.current) / 1000, 0);
                const m = multiplierAt(elapsed);
                drawCurve(w, h, elapsed, m, GOLD);

                const t = tipRef.current;
                sprite.style.transform =
                    `translate(${t.x - SPRITE_W / 2}px, ${t.y - SPRITE_W / 2}px) rotate(${t.angle}rad)`;

                // star magic streaming off the broom
                starsRef.current.push({
                    x: t.x + (Math.random() - 0.5) * 10,
                    y: t.y + (Math.random() - 0.5) * 10,
                    vx: -30 - Math.random() * 50,
                    vy: 20 + Math.random() * 40,
                    life: 0,
                    ttl: 0.5 + Math.random() * 0.4,
                    r: 2 + Math.random() * 4,
                    rot: Math.random() * Math.PI,
                    spin: (Math.random() - 0.5) * 6,
                    color: Math.random() < 0.7 ? GOLD : "#FFFFFF",
                });
                if (starsRef.current.length > 90) starsRef.current.splice(0, starsRef.current.length - 90);
            } else if (currentPhase === "crashed" && crashRef.current) {
                const point = Math.max(crashRef.current, 1.01);
                drawCurve(w, h, elapsedFor(point), point, RED);
            } else {
                sprite.style.transform = `translate(14px, ${H - SPRITE_W - 8}px)`;
            }

            starsRef.current = starsRef.current.filter((s) => {
                s.life += dt;
                if (s.life >= s.ttl) return false;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.rot += s.spin * dt;
                drawStar(ctx, s);
                return true;
            });
        };
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, []);

    return (
        <div ref={wrapRef} className="absolute inset-0 overflow-hidden pointer-events-none">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            <img
                ref={spriteRef}
                src={idle}
                alt="marisa"
                width={SPRITE_W}
                className="absolute top-0 left-0 w-20 select-none"
            />
        </div>
    );
};

export default CrashGraph;
