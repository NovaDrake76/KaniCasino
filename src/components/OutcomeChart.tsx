import { useMemo, useState } from "react";
import i18n from "../i18n";
import { OUTCOME_COLORS } from "./outcomeColors";

export interface OutcomeSeries {
  key: string;
  label: string;
  points: { at: string; priceBps: number }[];
}

interface Props {
  series: OutcomeSeries[];
  height?: number;
  loading?: boolean;
}

const W = 720;
const PAD = { top: 12, right: 10, bottom: 22, left: 34 };

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// the sibling of PriceChart for a market: one line per outcome, on a fixed 0 to 100 axis
// because a probability that only ever moves between 48 and 52 should look like it did.
const OutcomeChart: React.FC<Props> = ({ series, height = 240, loading }) => {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;

  const geom = useMemo(() => {
    const times = series.flatMap((s) => s.points.map((p) => new Date(p.at).getTime()));
    if (times.length === 0) return null;
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const span = t1 - t0;
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const x = (iso: string) =>
      PAD.left + (span <= 0 ? innerW / 2 : ((new Date(iso).getTime() - t0) / span) * innerW);
    const y = (bps: number) => PAD.top + innerH - (bps / 10000) * innerH;
    return { x, y, innerW, innerH, t0, t1, span };
  }, [series, H]);

  // the hover rail reads off the longest series, and every other line is sampled at the
  // same instant, so the readout is one moment in time rather than one point per line
  const rail = useMemo(() => {
    if (!geom) return [];
    const longest = series.reduce((best, s) => (s.points.length > best.points.length ? s : best), series[0]);
    return longest ? longest.points.map((p) => p.at) : [];
  }, [series, geom]);

  const valueAt = (line: OutcomeSeries, iso: string) => {
    const at = new Date(iso).getTime();
    let value = line.points.length ? line.points[0].priceBps : 0;
    for (const point of line.points) {
      if (new Date(point.at).getTime() > at) break;
      value = point.priceBps;
    }
    return value;
  };

  if (loading) {
    return <div className="w-full rounded-lg bg-surface-nav border border-line animate-pulse" style={{ height: H }} />;
  }

  if (!geom || series.length === 0) {
    return (
      <div
        className="w-full rounded-lg bg-surface-nav border border-line flex items-center justify-center text-sm text-ink-muted"
        style={{ height: H }}
      >
        {i18n.t("predictions.noPriceHistory")}
      </div>
    );
  }

  const { x, y, innerH } = geom;
  const hoveredAt = hover !== null ? rail[hover] : null;

  return (
    <div className="w-full rounded-lg bg-surface-nav border border-line p-2 relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} role="img" aria-label={i18n.t("predictions.priceHistory")}>
        {[0, 2500, 5000, 7500, 10000].map((bps) => (
          <g key={bps}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(bps)} y2={y(bps)} stroke="#2A2840" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(bps) + 3} textAnchor="end" fontSize="9" fill="#84819A">
              {bps / 100}%
            </text>
          </g>
        ))}

        {series.map((line, i) => (
          <polyline
            key={line.key}
            points={line.points.map((p) => `${x(p.at)},${y(p.priceBps)}`).join(" ")}
            fill="none"
            stroke={OUTCOME_COLORS[i % OUTCOME_COLORS.length]}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* a market nobody has traded is a single point, which no polyline will draw */}
        {series.map((line, i) =>
          line.points.length === 1 ? (
            <circle
              key={`dot${line.key}`}
              cx={x(line.points[0].at)}
              cy={y(line.points[0].priceBps)}
              r={3}
              fill={OUTCOME_COLORS[i % OUTCOME_COLORS.length]}
            />
          ) : null
        )}

        {hoveredAt && (
          <>
            <line
              x1={x(hoveredAt)}
              x2={x(hoveredAt)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="#3A365A"
              strokeWidth="1"
            />
            {series.map((line, i) => (
              <circle
                key={`h${line.key}`}
                cx={x(hoveredAt)}
                cy={y(valueAt(line, hoveredAt))}
                r={3.5}
                fill="#fff"
                stroke={OUTCOME_COLORS[i % OUTCOME_COLORS.length]}
                strokeWidth="2"
              />
            ))}
          </>
        )}

        {rail.length > 0 &&
          [rail[0], rail[Math.floor(rail.length / 2)], rail[rail.length - 1]]
            .filter((iso, idx, all) => all.indexOf(iso) === idx)
            .map((iso, idx, all) => (
              <text
                key={`x${iso}${idx}`}
                x={x(iso)}
                y={H - 6}
                textAnchor={idx === 0 ? "start" : idx === all.length - 1 ? "end" : "middle"}
                fontSize="9"
                fill="#84819A"
              >
                {fmtTime(iso)}
              </text>
            ))}

        {rail.map((iso, i) => {
          const left = i === 0 ? PAD.left : (x(rail[i - 1]) + x(iso)) / 2;
          const right = i === rail.length - 1 ? W - PAD.right : (x(iso) + x(rail[i + 1])) / 2;
          return (
            <rect
              key={`hit${i}`}
              x={left}
              y={PAD.top}
              width={Math.max(1, right - left)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {hoveredAt && (
        <div className="pointer-events-none absolute top-2 right-2 rounded-md bg-surface border border-line px-2 py-1 text-[11px] leading-tight">
          {series.map((line, i) => (
            <div key={line.key} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
              />
              <span className="text-ink-soft">{line.label}</span>
              <span className="text-ink font-semibold ml-auto">
                {Math.round(valueAt(line, hoveredAt) / 100)}%
              </span>
            </div>
          ))}
          <div className="text-ink-muted mt-1">{new Date(hoveredAt).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
};

export default OutcomeChart;
