const WIDTH = 260;
const HEIGHT = 96;

// cumulative profit over the session, one point per round. the baseline is zero, so the
// fill reads as ground gained or lost rather than as a range of values.
const Sparkline = ({ points }: { points: number[] }) => {
    if (points.length < 2) return null;

    const high = Math.max(0, ...points);
    const low = Math.min(0, ...points);
    // a flat run at zero would divide by nothing
    const span = high - low || 1;
    const x = (i: number) => (i / (points.length - 1)) * WIDTH;
    const y = (value: number) => HEIGHT - ((value - low) / span) * HEIGHT;
    const zero = y(0);

    const line = points.map((value, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const area = `${line} L${WIDTH},${zero.toFixed(1)} L0,${zero.toFixed(1)} Z`;
    const up = points[points.length - 1] >= 0;
    const stroke = up ? "#4ade80" : "#f87171";

    return (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
            <path d={area} fill={stroke} fillOpacity="0.15" />
            <line x1="0" y1={zero} x2={WIDTH} y2={zero} stroke="#3A365A" strokeWidth="1" strokeDasharray="3 3" />
            <path d={line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
    );
};

export default Sparkline;
