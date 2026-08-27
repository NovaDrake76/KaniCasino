import GameLayout from "../../components/game/GameLayout";
import GameButton from "../../components/game/GameButton";
import BetAmount from "../../components/game/BetAmount";
import ModeToggle from "../../components/game/ModeToggle";
import OptionRow from "../../components/game/OptionRow";
import Monetary from "../../components/Monetary";
import { AUTO_COUNTS } from "./Dice.services";
import { DiceViewProps } from "./Dice.types";
import i18n from "../../i18n";
import LiveStatsButton from "../../components/LiveStats/LiveStatsButton";
import GameBar from "../../components/game/GameBar";

const TICKS = [0, 25, 50, 75, 100];
const GREEN = "#22C55E";
const RED = "#EF4444";

const DiceView: React.FC<DiceViewProps> = ({
  isLogged,
  walletBalance,
  betInput,
  betValue,
  setBetInput,
  normalizeBet,
  halveBet,
  doubleBet,
  target,
  direction,
  controls,
  profitOnWin,
  changeWinChance,
  changeMultiplier,
  toggleDirection,
  dragging,
  trackHandlers,
  mode,
  setMode,
  autoCount,
  setAutoCount,
  autoRunning,
  autoLeft,
  startAuto,
  stopAuto,
  rolling,
  roll,
  last,
  history,
  openRoll,
}) => {
  const targetPct = target / 100;
  const markerPct = last ? last.resultValue : 50;
  // green fills the winning side: right of the target for "over", left for "under"
  const winGradient =
    direction === "over"
      ? `linear-gradient(to right, ${RED} 0%, ${RED} ${targetPct}%, ${GREEN} ${targetPct}%, ${GREEN} 100%)`
      : `linear-gradient(to right, ${GREEN} 0%, ${GREEN} ${targetPct}%, ${RED} ${targetPct}%, ${RED} 100%)`;

  return (
    <GameLayout
      bar={
        <GameBar>
          <LiveStatsButton />
        </GameBar>
      }
      title={i18n.t("dice.dice")}
      footer={
        <p className="text-ink-muted text-xs max-w-[640px] text-center">
          Balance: <Monetary value={walletBalance} />. Every roll is provably fair. 99% RTP, 1% house edge.
        </p>
      }
      panel={
        <>
          <ModeToggle mode={mode} setMode={setMode} />

          <BetAmount
            value={betInput}
            onChange={setBetInput}
            onBlur={normalizeBet}
            onHalve={halveBet}
            onDouble={doubleBet}
            betValue={betValue}
            disabled={autoRunning}
          />

          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted mt-1">
            <span>{i18n.t("crash.profitOnWin")}</span>
            <span className="text-accent-gold"><Monetary value={profitOnWin} showFraction /></span>
          </div>

          {mode === "auto" && (
            <OptionRow label={i18n.t("dice.numberOfBets")} options={AUTO_COUNTS} value={autoCount} onChange={setAutoCount} disabled={autoRunning} />
          )}

          {mode === "manual" ? (
            <GameButton onClick={roll} disabled={rolling}>
              {isLogged ? i18n.t("dice.rollDice") : i18n.t("upgrade.signInToPlay")}
            </GameButton>
          ) : (
            <GameButton onClick={autoRunning ? stopAuto : startAuto} variant={autoRunning ? "danger" : "primary"}>
              {autoRunning ? i18n.t("common.stopAuto", { left: autoLeft }) : isLogged ? i18n.t("common.startBets", { count: autoCount }) : i18n.t("upgrade.signInToPlay")}
            </GameButton>
          )}
        </>
      }
    >
      <div className="w-full flex flex-col gap-6">
          <div className="flex items-center justify-end gap-2 h-8 overflow-hidden">
            {history.map((h) => (
              <button
                key={h.key}
                onClick={() => h.rollId && openRoll(h.rollId)}
                className={`px-2 py-1 rounded text-xs font-bold shrink-0 ${h.won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
              >
                {h.resultValue.toFixed(2)}
              </button>
            ))}
          </div>

          <div className="px-2 pt-14 pb-1">
            <div className="flex justify-between text-xs text-ink-muted mb-2 font-semibold px-3">
              {TICKS.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div className="bg-surface-deep rounded-full p-2.5 border border-line shadow-inner">
              <div
                {...trackHandlers}
                className="relative h-3.5 rounded-full cursor-pointer touch-none select-none"
                style={{ background: winGradient }}
              >
                {last && (
                  <div
                    className={`absolute bottom-full mb-2 -translate-x-1/2 flex flex-col items-center pointer-events-none ${dragging ? "" : "transition-all duration-500 ease-out"}`}
                    style={{ left: `${markerPct}%` }}
                  >
                    <div
                      className={`w-12 h-12 rounded-lg rotate-45 flex items-center justify-center shadow-lg ${last.won ? "bg-green-500" : "bg-red-500"}`}
                    >
                      <span className="-rotate-45 text-white font-extrabold text-xs">
                        {last.resultValue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-8 bg-accent rounded shadow-md border-2 border-white/80 ${dragging ? "cursor-grabbing scale-110" : "cursor-grab"} transition-transform`}
                  style={{ left: `${targetPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">{i18n.t("dice.multiplier")}</span>
              <input
                type="number"
                step="0.0001"
                value={controls.multiplier}
                onChange={(e) => changeMultiplier(Number(e.target.value))}
                disabled={autoRunning}
                className="p-2 bg-surface-nav border border-line rounded text-sm disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">
                Roll {direction === "over" ? "Over" : "Under"}
              </span>
              <button
                onClick={toggleDirection}
                disabled={autoRunning}
                className="p-2 bg-surface-nav border border-line rounded text-sm flex items-center justify-between hover:bg-surface-raised disabled:opacity-50"
              >
                <span>{(target / 100).toFixed(2)}</span>
                <span className="text-ink-muted text-xs">⇄</span>
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">{i18n.t("dice.winChance")}</span>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={Number(controls.winChance.toFixed(2))}
                  onChange={(e) => changeWinChance(Number(e.target.value))}
                  disabled={autoRunning}
                  className="p-2 pr-7 bg-surface-nav border border-line rounded text-sm w-full disabled:opacity-50"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-xs">%</span>
              </div>
            </div>
          </div>

      </div>
    </GameLayout>
  );
};

export default DiceView;
