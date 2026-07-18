import { useMemo } from "react";
import { motion } from "framer-motion";
import Title from "../../components/Title";
import MainButton from "../../components/MainButton";
import Monetary from "../../components/Monetary";
import {
  BALL_RADIUS,
  BINS,
  BIN_H,
  BIN_W,
  BIN_Y,
  BOARD_H,
  BOARD_W,
  DROP_DURATION_S,
  MAX_WIN,
  PAYOUT_MULTIPLIERS,
  PEG_RADIUS,
  RISKS,
  ballKeyframes,
  binCenterX,
  binColor,
  binTextColor,
  formatMultiplier,
  pegRows,
} from "./plinkoBoard";
import { AUTO_COUNTS } from "./Plinko.services";
import { PlinkoBall, PlinkoViewProps } from "./Plinko.types";

const PEG_ROWS = pegRows();

const FallingBall = ({ ball, onSettle }: { ball: PlinkoBall; onSettle: (ball: PlinkoBall) => void }) => {
  const frames = useMemo(() => ballKeyframes(ball.path), [ball.path]);
  return (
    <motion.circle
      r={BALL_RADIUS}
      fill="#FFCC00"
      stroke="#151225"
      strokeWidth={2}
      initial={{ cx: frames.xs[0], cy: frames.ys[0] }}
      animate={{ cx: frames.xs, cy: frames.ys }}
      transition={{ duration: DROP_DURATION_S, times: frames.times, ease: "linear" }}
      onAnimationComplete={() => onSettle(ball)}
    />
  );
};

const PlinkoView: React.FC<PlinkoViewProps> = ({
  isLogged,
  betInput,
  betValue,
  maxBet,
  setBetInput,
  normalizeBet,
  halveBet,
  doubleBet,
  maxOutBet,
  risk,
  canChangeRisk,
  changeRisk,
  mode,
  setMode,
  autoCount,
  setAutoCount,
  autoRunning,
  autoLeft,
  startAuto,
  stopAuto,
  drop,
  dropping,
  balls,
  history,
  lastHit,
  settleBall,
  openRoll,
}) => (
  <div className="w-screen flex flex-col items-center py-6 px-4">
    <Title title="Plinko" />

    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-[1300px] pt-6">
      {/* control panel */}
      <div className="w-full lg:w-72 shrink-0 bg-[#212031] rounded-lg p-4 flex flex-col gap-4 self-start">
        <div className="flex bg-[#19172D] rounded p-1">
          {(["manual", "auto"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={autoRunning}
              className={`flex-1 py-2 rounded text-sm font-semibold capitalize transition-colors ${
                mode === m ? "bg-[#281D3F]" : "text-[#84819a] hover:text-white"
              } disabled:opacity-50`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[#84819a]">Amount</span>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={maxBet}
              value={betInput}
              onChange={(e) => setBetInput(e.target.value)}
              onBlur={normalizeBet}
              className="w-full min-w-0 bg-[#19172D] border border-gray-700 focus:border-indigo-500 outline-none rounded px-3 py-2 text-sm"
            />
            <button onClick={halveBet} className="px-2 rounded bg-[#281D3F] hover:bg-[#3a2c5c] text-xs font-semibold">
              1/2
            </button>
            <button onClick={doubleBet} className="px-2 rounded bg-[#281D3F] hover:bg-[#3a2c5c] text-xs font-semibold">
              x2
            </button>
            <button onClick={maxOutBet} className="px-2 rounded bg-[#281D3F] hover:bg-[#3a2c5c] text-xs font-semibold">
              Max
            </button>
          </div>
          <span className="text-xs text-[#84819a]">
            Bet 1 to {maxBet.toLocaleString("en-US")} on {risk} risk
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[#84819a]">Risk</span>
          <div className="flex gap-2">
            {RISKS.map((r) => (
              <button
                key={r}
                onClick={() => changeRisk(r)}
                disabled={!canChangeRisk}
                className={`flex-1 py-2 rounded text-sm font-semibold capitalize transition-colors ${
                  risk === r ? "bg-indigo-600" : "bg-[#19172D] text-[#84819a] hover:text-white"
                } disabled:opacity-50`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {mode === "auto" && (
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[#84819a]">Balls</span>
            <div className="flex gap-2">
              {AUTO_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setAutoCount(n)}
                  disabled={autoRunning}
                  className={`flex-1 py-2 rounded text-sm font-semibold ${
                    autoCount === n ? "bg-indigo-600" : "bg-[#19172D] text-[#84819a] hover:text-white"
                  } disabled:opacity-50`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "manual" ? (
          <MainButton
            text={
              isLogged ? (
                <div className="flex items-center justify-center text-base">
                  <span className="mr-1">Drop ball - </span>
                  <Monetary value={betValue} />
                </div>
              ) : (
                "Sign in to play"
              )
            }
            onClick={drop}
            loading={dropping}
            disabled={dropping}
          />
        ) : autoRunning ? (
          <MainButton text={`Stop (${autoLeft} left)`} onClick={stopAuto} type="danger" />
        ) : (
          <MainButton
            text={
              isLogged ? (
                <div className="flex items-center justify-center text-base">
                  <span className="mr-1">Drop {autoCount} balls - </span>
                  <Monetary value={betValue * autoCount} />
                </div>
              ) : (
                "Sign in to play"
              )
            }
            onClick={startAuto}
          />
        )}

        <div className="text-xs text-[#84819a] border-t border-[#2a2840] pt-3 flex flex-col gap-1">
          <span className="flex items-center gap-1">
            Max win <Monetary value={MAX_WIN} />
          </span>
          <span>Every drop is provably fair; click a result to verify it.</span>
        </div>
      </div>

      {/* board */}
      <div className="relative flex-1 flex justify-center">
        <div className="absolute right-0 top-0 flex flex-col gap-1 items-end z-10">
          {history.map((h) => (
            <motion.button
              key={h.key}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => h.rollId && openRoll(h.rollId)}
              title={h.rollId ? `Roll ${h.rollId}` : undefined}
              className="px-2 py-1 rounded text-xs font-bold"
              style={{ backgroundColor: binColor(h.bin), color: binTextColor(h.bin) }}
            >
              {formatMultiplier(h.multiplier)}
            </motion.button>
          ))}
        </div>

        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} className="w-full max-w-[760px]">
          {PEG_ROWS.map((row, i) =>
            row.map((peg, k) => (
              <circle key={`${i}-${k}`} cx={peg.x} cy={peg.y} r={PEG_RADIUS} fill="#cfccdf" />
            ))
          )}

          {Array.from({ length: BINS }, (_, k) => {
            const label = formatMultiplier(PAYOUT_MULTIPLIERS[risk][k]);
            const chip = (
              <>
                <rect
                  x={binCenterX(k) - BIN_W / 2}
                  y={BIN_Y}
                  width={BIN_W}
                  height={BIN_H}
                  rx={6}
                  fill={binColor(k)}
                />
                <text
                  x={binCenterX(k)}
                  y={BIN_Y + BIN_H / 2 + 4}
                  textAnchor="middle"
                  fontSize={label.length > 4 ? 11 : 13}
                  fontWeight={700}
                  fill={binTextColor(k)}
                >
                  {label}
                </text>
              </>
            );
            return lastHit && lastHit.bin === k ? (
              <motion.g
                key={`${k}-${lastHit.seq}`}
                initial={{ y: 0 }}
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 0.3 }}
              >
                {chip}
              </motion.g>
            ) : (
              <g key={`${k}-static`}>{chip}</g>
            );
          })}

          {balls.map((ball) => (
            <FallingBall key={ball.key} ball={ball} onSettle={settleBall} />
          ))}
        </svg>
      </div>
    </div>
  </div>
);

export default PlinkoView;
