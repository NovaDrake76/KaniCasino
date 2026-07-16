import { useMemo, useState } from "react";

export interface PricePoint {
  t: string;
  median: number;
  avg: number;
  min: number;
  max: number;
  volume: number;
}

interface Props {
  points: PricePoint[];
  floor?: number | null; // the house always pays this: a hard price floor
  height?: number;
  loading?: boolean;
}

const W = 720; // viewBox units; the svg scales to its container
const PAD = { top: 12, right: 8, bottom: 22, left: 46 };

const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// a small hand-rolled chart: median price line + volume bars. no charting dep, so it
// stays honest about what it draws and costs nothing in bundle size.
const PriceChart: React.FC<Props> = ({ points, floor, height = 220, loading }) => {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;

  const geom = useMemo(() => {
    if (!points.length) return null;
    const prices = points.flatMap((p) => [p.median]);
    const withFloor = floor && floor > 0 ? [...prices, floor] : prices;
    let lo = Math.min(...withFloor);
    let hi = Math.max(...withFloor);
    if (hi === lo) {
      // a flat series still deserves a readable band
      hi = lo + Math.max(1, lo * 0.1);
      lo = Math.max(0, lo - Math.max(1, lo * 0.1));
    }
    const pad = (hi - lo) * 0.1;
    lo = Math.max(0, lo - pad);
    hi = hi + pad;

    const maxVol = Math.max(...points.map((p) => p.volume), 1);
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;

    return { lo, hi, maxVol, innerW, innerH, x, y };
  }, [points, floor, H]);

  if (loading) {
    return (
      <div
        className="w-full rounded-lg bg-surface-nav border border-line animate-pulse"
        style={{ height: H }}
      />
    );
  }

  if (!points.length || !geom) {
    return (
      <div
        className="w-full rounded-lg bg-surface-nav border border-line flex items-center justify-center text-sm text-ink-muted"
        style={{ height: H }}
      >
        No sales recorded in this period yet.
      </div>
    );
  }

  const { lo, hi, maxVol, innerW, innerH, x, y } = geom;
  const line = points.map((p, i) => `${x(i)},${y(p.median)}`).join(" ");
  const area = `${PAD.left},${PAD.top + innerH} ${line} ${x(points.length - 1)},${PAD.top + innerH}`;
  const gridVals = [lo, lo + (hi - lo) / 2, hi];
  const barW = Math.max(1, Math.min(14, innerW / points.length - 2));
  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="w-full rounded-lg bg-surface-nav border border-line p-2 relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} role="img" aria-label="price history">
        <defs>
          <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#2A2840" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#84819A">
              {fmtK(v)}
            </text>
          </g>
        ))}

        {/* volume bars sit on the baseline, scaled to a third of the plot */}
        {points.map((p, i) => {
          const h = (p.volume / maxVol) * (innerH * 0.28);
          return (
            <rect
              key={`v${i}`}
              x={x(i) - barW / 2}
              y={PAD.top + innerH - h}
              width={barW}
              height={h}
              fill="#4F46E5"
              opacity={hover === i ? 0.5 : 0.18}
            />
          );
        })}

        {floor && floor > 0 && floor >= lo && floor <= hi && (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(floor)}
              y2={y(floor)}
              stroke="#FFCC00"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.7"
            />
            <text x={W - PAD.right} y={y(floor) - 4} textAnchor="end" fontSize="9" fill="#FFCC00">
              house floor
            </text>
          </g>
        )}

        <polygon points={area} fill="url(#pcFill)" />
        <polyline points={line} fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={`p${i}`}
            cx={x(i)}
            cy={y(p.median)}
            r={hover === i ? 3.5 : 0}
            fill="#fff"
            stroke="#4F46E5"
            strokeWidth="2"
          />
        ))}

        {/* x labels: first, middle, last only, so they never collide */}
        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((i, idx, a) => a.indexOf(i) === idx && points[i])
          .map((i) => (
            <text
              key={`x${i}`}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize="9"
              fill="#84819A"
            >
              {fmtDate(points[i].t)}
            </text>
          ))}

        {/* invisible hit areas drive the tooltip */}
        {points.map((_, i) => (
          <rect
            key={`h${i}`}
            x={x(i) - innerW / points.length / 2}
            y={PAD.top}
            width={innerW / points.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {hp && (
        <div className="pointer-events-none absolute top-2 right-2 rounded-md bg-surface border border-line px-2 py-1 text-[11px] leading-tight">
          <div className="text-ink font-semibold">K₽{hp.median.toLocaleString()}</div>
          <div className="text-ink-muted">
            {hp.volume} sale{hp.volume === 1 ? "" : "s"} · {fmtDate(hp.t)}
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceChart;
