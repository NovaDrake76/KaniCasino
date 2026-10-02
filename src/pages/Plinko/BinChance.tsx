import i18n from "../../i18n";
import { BIN_Y, BOARD_W, binCenterX, binChance, formatChance } from "./plinkoBoard";

const MIN_W = 150;
const H = 80;
const EDGE = 6;

// the chance of the hovered bin, drawn in board units so it sits on its bin at any board size
const BinChance = ({ bin }: { bin: number }) => {
  const label = i18n.t("plinko.landChance");
  const w = Math.max(MIN_W, label.length * 9.4 + 32);
  const cx = binCenterX(bin);
  const x = Math.min(Math.max(cx, w / 2 + EDGE), BOARD_W - w / 2 - EDGE);
  const bottom = BIN_Y - 14;
  return (
    <g role="tooltip" pointerEvents="none">
      <defs>
        <filter id="plinko-chance-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.55" />
        </filter>
      </defs>
      <g filter="url(#plinko-chance-shadow)">
        <rect x={x - w / 2} y={bottom - H} width={w} height={H} rx={10} fill="#19172D" />
        <path d={`M ${cx - 10} ${bottom} L ${cx + 10} ${bottom} L ${cx} ${bottom + 11} Z`} fill="#19172D" />
      </g>
      <text x={x} y={bottom - H + 38} textAnchor="middle" fontSize={30} fontWeight={800} fill="#FFFFFF">
        {formatChance(binChance(bin))}
      </text>
      <text x={x} y={bottom - 17} textAnchor="middle" fontSize={17} fill="#C9C6DE">
        {label}
      </text>
    </g>
  );
};

export default BinChance;
