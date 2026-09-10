import { useId } from "react";
import type { Face } from "./Daisu.types";

interface Props {
  // how full the jar is, 0 to 1
  fill: number;
  face: Face;
  shaking?: boolean;
  // head and shoulders only, for the collapsed bubble
  bust?: boolean;
  className?: string;
}

const HAIR = "#3D2B63";
const HAIR_LIGHT = "#5B4590";
const SKIN = "#F7DCC8";
const INK = "#1A1633";
const EYE = "#4F46E5";
const PINK = "#E5308C";
const DRESS = "#2A2840";
const GOLD = "#FFCC00";
const GOLD_DARK = "#ECA823";
const GLASS = "#C9C6DE";

const JAR_TOP = 134;
const JAR_BOTTOM = 194;
const JAR_LEFT = 64;
const JAR_WIDTH = 72;

const coinRows = () => {
  const coins: { cx: number; cy: number }[] = [];
  for (let row = 0; row < 7; row++) {
    const cy = JAR_BOTTOM - 5 - row * 9;
    const shift = row % 2 ? 5 : 0;
    for (let col = 0; col < 7; col++) coins.push({ cx: JAR_LEFT + 6 + shift + col * 10, cy });
  }
  return coins;
};
const COINS = coinRows();

const Eye = ({ cx, face }: { cx: number; face: Face }) => {
  if (face === "happy") {
    return <path d={`M${cx - 8} 97 Q${cx} 86 ${cx + 8} 97`} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  }
  const wide = face === "surprised";
  return (
    <g>
      <ellipse cx={cx} cy={94} rx={wide ? 10 : 9} ry={wide ? 13 : 12} fill="#fff" />
      <ellipse cx={cx} cy={95} rx={wide ? 5.5 : 6.5} ry={wide ? 8 : 9.5} fill={EYE} />
      <ellipse cx={cx} cy={96} rx={wide ? 2.5 : 3} ry={wide ? 4 : 5} fill={INK} />
      <circle cx={cx - 2.5} cy={90} r="2.4" fill="#fff" />
      {face === "sad" && <rect x={cx - 10} y={82} width={20} height={9} fill={SKIN} />}
      <rect className="daisu-lid" x={cx - 10} y={82} width={20} height={24} fill={SKIN} />
    </g>
  );
};

const Mouth = ({ face }: { face: Face }) => {
  if (face === "happy") return <path d="M94 108 Q100 117 106 108 Z" fill="#B23A5C" />;
  if (face === "surprised") return <circle cx="100" cy="111" r="3.4" fill="#B23A5C" />;
  if (face === "sad") return <path d="M96 113 Q100 108 104 113" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  return <path d="M96 110 Q100 113.5 104 110" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
};

// daisu, drawn in shapes so the jar she holds can be the gauge itself. swapping her for
// painted art only touches this file: the props are the whole contract.
const DaisuMascot = ({ fill, face, shaking, bust, className }: Props) => {
  const id = useId();
  const clipId = `daisu-coins-${id}`;
  const level = Math.max(0, Math.min(1, fill));
  const coinsTop = JAR_BOTTOM - (JAR_BOTTOM - JAR_TOP) * level;

  return (
    <svg
      viewBox={bust ? "26 6 148 134" : "0 0 200 236"}
      className={className}
      role="img"
      aria-label="Daisu"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={JAR_LEFT} y={coinsTop} width={JAR_WIDTH} height={JAR_BOTTOM - coinsTop} style={{ transition: "y 0.6s ease, height 0.6s ease" }} />
        </clipPath>
      </defs>

      <g className={face === "happy" ? "daisu-hop" : "daisu-bob"}>
        <ellipse cx="42" cy="104" rx="21" ry="48" transform="rotate(-9 42 104)" fill={HAIR} />
        <ellipse cx="158" cy="104" rx="21" ry="48" transform="rotate(9 158 104)" fill={HAIR} />
        <path d="M34 80 Q30 120 40 146" stroke={HAIR_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M166 80 Q170 120 160 146" stroke={HAIR_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" />

        <polygon points="58,52 70,14 90,44" fill={HAIR} />
        <polygon points="142,52 130,14 110,44" fill={HAIR} />
        <polygon points="65,47 71,26 83,42" fill={PINK} opacity="0.75" />
        <polygon points="135,47 129,26 117,42" fill={PINK} opacity="0.75" />

        <circle cx="100" cy="80" r="50" fill={HAIR} />
        <circle cx="100" cy="88" r="44" fill={SKIN} />
        <path
          d="M54 82 Q56 38 100 36 Q144 38 146 82 L140 84 L131 66 L125 86 L115 64 L107 86 L100 70 L93 86 L85 64 L75 86 L69 66 L60 84 Z"
          fill={HAIR}
        />
        <path d="M100 37 Q103 20 119 23 Q107 25 104 40 Z" fill={HAIR} />
        <path d="M62 60 Q64 48 74 44" stroke={HAIR_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" />

        <polygon points="70,58 75,65 70,72 65,65" fill={GOLD} />
        <path d="M64 84 L57 76.5 A3.6 3.6 0 0 1 64 72.5 A3.6 3.6 0 0 1 71 76.5 Z" fill={PINK} />

        {face === "happy" && (
          <g opacity="0.55">
            <ellipse cx="74" cy="104" rx="6" ry="3.5" fill={PINK} />
            <ellipse cx="126" cy="104" rx="6" ry="3.5" fill={PINK} />
          </g>
        )}
        <Eye cx={82} face={face} />
        <Eye cx={118} face={face} />
        <Mouth face={face} />

        {!bust && (
          <g>
            <rect x="95" y="128" width="10" height="9" fill={SKIN} />
            <path d="M74 136 Q100 127 126 136 L138 204 L62 204 Z" fill={DRESS} />
            <path d="M90 134 L100 147 L110 134 Z" fill="#fff" />
            <rect x="64" y="186" width="72" height="7" fill={INK} />
            <rect x="86" y="202" width="11" height="18" fill={SKIN} />
            <rect x="103" y="202" width="11" height="18" fill={SKIN} />
            <rect x="83" y="216" width="17" height="14" rx="3" fill={INK} />
            <rect x="100" y="216" width="17" height="14" rx="3" fill={INK} />
            <rect x="60" y="140" width="13" height="42" rx="6.5" transform="rotate(-16 66 161)" fill={SKIN} />
            <rect x="127" y="140" width="13" height="42" rx="6.5" transform="rotate(16 134 161)" fill={SKIN} />

            <g className={shaking ? "daisu-shake" : undefined}>
              <g clipPath={`url(#${clipId})`}>
                {COINS.map((c) => (
                  <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r="5" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.2" />
                ))}
              </g>
              <rect x={JAR_LEFT} y={JAR_TOP} width={JAR_WIDTH} height={JAR_BOTTOM - JAR_TOP} rx="8" fill="#fff" opacity="0.1" />
              <rect x={JAR_LEFT} y={JAR_TOP} width={JAR_WIDTH} height={JAR_BOTTOM - JAR_TOP} rx="8" fill="none" stroke={GLASS} strokeWidth="2.2" />
              <rect x="68" y="125" width="64" height="10" rx="2" fill="#3A365A" stroke={GLASS} strokeWidth="1.5" />
              <circle cx="100" cy="164" r="12" fill={INK} opacity="0.85" />
              <text x="100" y="168" textAnchor="middle" fontSize="11" fontWeight="700" fill={GOLD} fontFamily="inherit">
                KP
              </text>
              {level >= 1 && (
                <path
                  className="daisu-sparkle"
                  d="M56 124 l-7 -7 M144 124 l7 -7 M50 150 l-10 0 M150 150 l10 0"
                  stroke={GOLD}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              )}
            </g>
            <circle cx="66" cy="178" r="7.5" fill={SKIN} />
            <circle cx="134" cy="178" r="7.5" fill={SKIN} />
          </g>
        )}
      </g>
    </svg>
  );
};

export default DaisuMascot;
