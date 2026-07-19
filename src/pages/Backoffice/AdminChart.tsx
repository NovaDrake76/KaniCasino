import { useMemo, useState } from "react";
import { CHART_AMBER, CHART_INDIGO, compactKp, shortDay } from "./adminSeries";

interface AdminChartProps {
  title: string;
  points: { day: string; values: number[] }[];
  series: { name: string; color: string }[];
  mode: "bars" | "lines";
  polarity?: boolean;
  money?: boolean;
}

const W = 720;
const H = 190;
const PAD = { top: 10, right: 8, bottom: 20, left: 48 };

const AdminChart: React.FC<AdminChartProps> = ({ title, points, series, mode, polarity, money }) => {
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const all = points.flatMap((p) => p.values);
    let lo = Math.min(0, ...all);
    let hi = Math.max(0, ...all);
    if (hi === lo) hi = lo + 1;
    const pad = (hi - lo) * 0.08;
    if (lo < 0) lo -= pad;
    hi += pad;
    const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;
    const step = points.length ? plotW / points.length : plotW;
    const x = (i: number) => PAD.left + step * (i + 0.5);
    return { plotW, plotH, lo, hi, y, x, step };
  }, [points]);

  const ticks = [geom.hi, (geom.hi + geom.lo) / 2, geom.lo];
  const hasData = points.some((p) => p.values.some((v) => v !== 0));
  const fmt = (v: number) => (money ? `${compactKp(v)} KP` : Math.round(v).toLocaleString());
  const barColor = (v: number) => (polarity ? (v >= 0 ? CHART_INDIGO : CHART_AMBER) : series[0].color);

  return (
    <div className="bg-surface rounded-lg p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-ink font-semibold">{title}</h2>
        {series.length > 1 && (
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            {series.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No activity in this window.</div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={PAD.left} x2={W - PAD.right} y1={geom.y(t)} y2={geom.y(t)} stroke="#2A2840" strokeWidth={1} />
                <text x={PAD.left - 6} y={geom.y(t) + 4} textAnchor="end" fontSize={11} fill="#84819A">
                  {money ? compactKp(t) : Math.round(t).toLocaleString()}
                </text>
              </g>
            ))}
            {geom.lo < 0 && (
              <line x1={PAD.left} x2={W - PAD.right} y1={geom.y(0)} y2={geom.y(0)} stroke="#3A365A" strokeWidth={1} />
            )}

            {mode === "bars" &&
              points.map((p, i) => {
                const v = p.values[0];
                const top = Math.min(geom.y(v), geom.y(0));
                const h = Math.max(Math.abs(geom.y(v) - geom.y(0)), v === 0 ? 0 : 2);
                const w = Math.max(geom.step - 2, 1);
                return (
                  <rect
                    key={p.day}
                    x={geom.x(i) - w / 2}
                    y={top}
                    width={w}
                    height={h}
                    rx={Math.min(2, w / 2)}
                    fill={barColor(v)}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                );
              })}

            {mode === "lines" &&
              series.map((s, si) => (
                <g key={s.name}>
                  <polyline
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    points={points.map((p, i) => `${geom.x(i)},${geom.y(p.values[si])}`).join(" ")}
                  />
                  {hover !== null && points[hover] && (
                    <circle
                      cx={geom.x(hover)}
                      cy={geom.y(points[hover].values[si])}
                      r={4}
                      fill={s.color}
                      stroke="#212031"
                      strokeWidth={2}
                    />
                  )}
                </g>
              ))}

            {points.map((p, i) => (
              <rect
                key={`hit-${p.day}`}
                x={PAD.left + geom.step * i}
                y={PAD.top}
                width={geom.step}
                height={geom.plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}

            {[0, Math.floor((points.length - 1) / 2), points.length - 1]
              .filter((i, k, arr) => points[i] && arr.indexOf(i) === k)
              .map((i) => (
                <text key={`x-${i}`} x={geom.x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="#84819A">
                  {shortDay(points[i].day)}
                </text>
              ))}
          </svg>

          {hover !== null && points[hover] && (
            <div
              className="absolute top-1 pointer-events-none bg-surface-nav border border-line rounded-md px-3 py-2 text-xs z-10"
              style={{
                left: `${((hover + 0.5) / points.length) * 100}%`,
                transform: hover > points.length / 2 ? "translateX(-105%)" : "translateX(5%)",
              }}
            >
              <div className="text-ink-muted mb-1">{points[hover].day}</div>
              {series.map((s, si) => (
                <div key={s.name} className="flex items-center gap-1.5 text-ink">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
                  {series.length > 1 && <span className="text-ink-muted">{s.name}</span>}
                  <span className="font-semibold">{fmt(points[hover].values[si])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminChart;
