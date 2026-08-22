import { memo, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import GameLayout from "../../components/game/GameLayout";
import GameButton from "../../components/game/GameButton";
import BetAmount from "../../components/game/BetAmount";
import ModeToggle from "../../components/game/ModeToggle";
import OptionRow from "../../components/game/OptionRow";
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
  DROP_X,
  DROP_Y,
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
import i18n from "../../i18n";

const PEG_ROWS = pegRows();

// pegs never re-render; pulses run as a css animation outside react so a hundred
// concurrent balls cannot flood the tree with state updates
const PegField = memo(() => (
  <>
    {PEG_ROWS.map((row, i) =>
      row.map((peg, k) => (
        <circle
          key={`${i}-${k}`}
          id={`peg-${i}-${k}`}
          className="peg"
          cx={peg.x}
          cy={peg.y}
          r={PEG_RADIUS}
          fill="#cfccdf"
        />
      ))
    )}
  </>
));

const PEG_PULSE: Keyframe[] = [
  { transform: "scale(1)", fill: "#cfccdf" },
  { transform: "scale(1.8)", fill: "#ffe08a", offset: 0.4 },
  { transform: "scale(1)", fill: "#cfccdf" },
];

const pulsePegElement = (row: number, index: number) => {
  const peg = document.getElementById(`peg-${row}-${index}`);
  if (!peg || typeof peg.animate !== "function") return;
  // a web animation restarts on its own. the css class needed a forced reflow to do the
  // same, and sixteen of those per ball is what made a long auto run stutter.
  peg.getAnimations().forEach((animation) => animation.cancel());
  peg.animate(PEG_PULSE, { duration: 350, easing: "ease-out" });
};

const FallingBall = memo(({ ball, onSettle }: { ball: PlinkoBall; onSettle: (ball: PlinkoBall) => void }) => {
  const frames = useMemo(() => ballKeyframes(ball.path, Math.random), [ball.path]);

  // pulse each peg right as the ball reaches it
  useEffect(() => {
    const timers = frames.hits.map((h) =>
      setTimeout(() => pulsePegElement(h.row, h.index), h.t * DROP_DURATION_S * 1000)
    );
    return () => timers.forEach(clearTimeout);
  }, [frames]);

  return (
    <motion.circle
      r={BALL_RADIUS}
      fill="#FFCC00"
      stroke="#151225"
      strokeWidth={2}
      initial={{ cx: frames.xs[0], cy: frames.ys[0] }}
      animate={{ cx: frames.xs, cy: frames.ys }}
      transition={{ duration: DROP_DURATION_S, times: frames.times, ease: frames.eases }}
      onAnimationComplete={() => onSettle(ball)}
    />
  );
});

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
  canDrop,
  pendingDrops,
  balls,
  history,
  lastHit,
  settleBall,
  openRoll,
}) => (
  <GameLayout
    title={i18n.t("nav.plinko")}
    panel={
      <>
        <ModeToggle mode={mode} setMode={setMode} manualDisabled={autoRunning} autoDisabled={autoRunning} />

        <BetAmount
          value={betInput}
          onChange={setBetInput}
          onBlur={normalizeBet}
          onHalve={halveBet}
          onDouble={doubleBet}
          onMax={maxOutBet}
          betValue={betValue}
          hint={i18n.t("plinko.betRange", { max: maxBet.toLocaleString("en-US"), risk })}
        />

        <OptionRow label={i18n.t("plinko.risk")} options={RISKS} value={risk} onChange={changeRisk} disabled={!canChangeRisk} />

        {mode === "auto" && (
          <OptionRow label={i18n.t("plinko.balls")} options={AUTO_COUNTS} value={autoCount} onChange={setAutoCount} disabled={autoRunning} />
        )}

        {mode === "manual" ? (
          <GameButton onClick={drop} disabled={!canDrop}>
            {isLogged ? (
              <span className="flex items-center justify-center gap-1">
                Drop ball <Monetary value={betValue} />
              </span>
            ) : (
              i18n.t("upgrade.signInToPlay")
            )}
          </GameButton>
        ) : autoRunning ? (
          <GameButton onClick={stopAuto} variant="danger">
            {i18n.t("common.stopAuto", { left: autoLeft })}
          </GameButton>
        ) : (
          <GameButton onClick={startAuto}>
            {isLogged ? (
              <span className="flex items-center justify-center gap-1">
                Drop {autoCount} balls <Monetary value={betValue * autoCount} />
              </span>
            ) : (
              i18n.t("upgrade.signInToPlay")
            )}
          </GameButton>
        )}

        <div className="text-xs text-[#84819a] border-t border-[#2a2840] pt-3 flex flex-col gap-1">
          <span className="flex items-center gap-1">
            Max win <Monetary value={MAX_WIN} />
          </span>
          <span>{i18n.t("plinko.provablyFairHint")}</span>
        </div>
      </>
    }
  >
    <div className="relative w-full flex justify-center">
      <div className="absolute right-0 top-0 flex flex-col gap-1 items-end z-10">
        {history.map((h) => (
          <motion.button
            key={h.key}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => h.rollId && openRoll(h.rollId)}
            title={h.rollId ? i18n.t("plinko.rollId", { id: h.rollId }) : undefined}
            className="px-2 py-1 rounded text-xs font-bold"
            style={{ backgroundColor: binColor(h.bin), color: binTextColor(h.bin) }}
          >
            {formatMultiplier(h.multiplier)}
          </motion.button>
        ))}
      </div>

      <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} className="w-full max-w-[680px]">
        <PegField />

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

        {/* one ghost per drop still waiting on the server, so a click is visibly queued */}
        {Array.from({ length: pendingDrops }, (_, i) => (
          <circle
            key={`q-${i}`}
            className="ball-queued"
            cx={DROP_X + (i - (pendingDrops - 1) / 2) * BALL_RADIUS * 2.5}
            cy={DROP_Y}
            r={BALL_RADIUS * 0.8}
            fill="#FFCC00"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}

        {balls.map((ball) => (
          <FallingBall key={ball.key} ball={ball} onSettle={settleBall} />
        ))}
      </svg>
    </div>
  </GameLayout>
);

export default PlinkoView;
