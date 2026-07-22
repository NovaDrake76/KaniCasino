import Title from "../../components/Title";
import MainButton from "../../components/MainButton";
import Monetary from "../../components/Monetary";
import PlayingCard from "./PlayingCard";
import { outcomeLabel, totalLabel } from "./blackjackCards";
import { BlackjackViewProps } from "./Blackjack.types";

const OUTCOME_TEXT: Record<string, string> = {
  blackjack: "text-[#FFCC00]",
  win: "text-green-400",
  push: "text-[#84819a]",
  lose: "text-red-400",
};

const HandBadge = ({ label, tone }: { label: string; tone?: string }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full bg-[#19172D] border border-[#2A2840] text-xs font-semibold ${tone || "text-white"}`}
  >
    {label}
  </span>
);

const BlackjackView: React.FC<BlackjackViewProps> = ({
  walletBalance,
  betInput,
  betValue,
  setBetInput,
  normalizeBet,
  halveBet,
  doubleBet,
  maxOutBet,
  phase,
  hand,
  playerHand,
  acting,
  revealStep,
  instant,
  setInstant,
  history,
  deal,
  hit,
  stand,
  double,
  rebet,
  canHit,
  canStand,
  canDouble,
  openRoll,
}) => {
  const betting = phase === "idle" || phase === "settled";
  const settledOutcome = phase === "settled" ? playerHand?.outcome : null;
  const dealerCards = hand?.dealer.cards ?? [];
  const holeHidden = !!hand && (hand.dealer.hidden || revealStep < 2);
  const dealerShown = hand && !hand.dealer.hidden ? dealerCards.slice(0, Math.max(revealStep, 1)) : [];
  const dealerLabel = !hand
    ? ""
    : hand.dealer.hidden || revealStep < 2
      ? totalLabel([dealerCards[0]])
      : totalLabel(dealerShown.length ? dealerShown : dealerCards.slice(0, 2));

  return (
    <div className="w-full flex flex-col items-center py-6 px-3">
      <Title title="Blackjack" />
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-[1100px] mt-4">
        {/* control panel */}
        <div className="w-full lg:w-72 shrink-0 order-2 lg:order-1 bg-[#212031] rounded-lg p-4 flex flex-col gap-3 h-fit">
          {phase === "settled" && settledOutcome && (
            <div className="rounded bg-[#19172D] px-3 py-2 text-center">
              <span className={`font-bold ${OUTCOME_TEXT[settledOutcome] || ""}`}>
                {outcomeLabel(settledOutcome)}
              </span>
              {hand && hand.totalPayout > 0 && (
                <span className="block text-sm text-[#FFCC00]">
                  +<Monetary value={hand.totalPayout} />
                </span>
              )}
            </div>
          )}

          <label className="text-xs uppercase tracking-wider text-[#84819a]">Bet amount</label>
          <input
            value={betInput}
            onChange={(e) => setBetInput(e.target.value)}
            onBlur={normalizeBet}
            disabled={!betting || acting}
            inputMode="numeric"
            className="w-full bg-[#19172D] border border-[#2A2840] focus:border-indigo-500 outline-none rounded px-3 py-2 text-sm disabled:opacity-60"
          />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "1/2", fn: halveBet },
              { label: "x2", fn: doubleBet },
              { label: "Max", fn: maxOutBet },
            ].map((b) => (
              <button
                key={b.label}
                onClick={b.fn}
                disabled={!betting || acting}
                className="py-1.5 rounded bg-[#281D3F] hover:bg-[#3A2C5C] text-sm font-semibold disabled:opacity-50"
              >
                {b.label}
              </button>
            ))}
          </div>

          {betting ? (
            <div className="flex flex-col gap-2">
              <MainButton
                text={acting ? "Dealing..." : "Deal"}
                onClick={() => deal()}
                disabled={acting || betValue > walletBalance}
              />
              {phase === "settled" && (
                <div className="grid grid-cols-2 gap-2">
                  <MainButton text="Rebet" type="dark" onClick={() => rebet(1)} disabled={acting} />
                  <MainButton text="Rebet x2" type="dark" onClick={() => rebet(2)} disabled={acting} />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <MainButton text="Hit (H)" onClick={hit} disabled={!canHit} />
              <MainButton text="Stand (S)" type="dark" onClick={stand} disabled={!canStand} />
              <div className="col-span-2 flex flex-col">
                <MainButton text="Double (D)" type="dark" onClick={double} disabled={!canDouble} />
                <span className="text-[10px] text-center text-[#84819a] mt-1">
                  costs another <Monetary value={hand?.betAmount ?? betValue} />
                </span>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-[#84819a] mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={instant}
              onChange={(e) => setInstant(e.target.checked)}
              className="accent-indigo-600"
            />
            Instant reveal
          </label>

          {history.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-xs uppercase tracking-wider text-[#84819a]">History</span>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h) => (
                  <button
                    key={h.handId}
                    onClick={() => h.rollId && openRoll(h.rollId)}
                    title={h.rollId ? `Verify ${h.rollId}` : "No roll id"}
                    className={`px-2 py-0.5 rounded text-xs font-semibold bg-[#19172D] border border-[#2A2840] hover:bg-[#281D3F] ${OUTCOME_TEXT[h.outcome || ""] || "text-white"}`}
                  >
                    {h.payout > 0 ? `+${h.payout}` : `-${h.betAmount}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* table */}
        <div className="flex-1 order-1 lg:order-2 rounded-lg bg-[#1a1830] p-4 sm:p-8 flex flex-col items-center justify-between min-h-[420px] sm:min-h-[480px] [background:radial-gradient(ellipse_at_top,#221f3d_0%,#1a1830_65%)]">
          {/* dealer */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-[#84819a]">Dealer</span>
            <div className="flex gap-2 min-h-[100px] items-center">
              {hand ? (
                hand.dealer.hidden ? (
                  <>
                    <PlayingCard card={dealerCards[0]} delay={0.18} instant={instant} />
                    <PlayingCard faceDown delay={0.54} instant={instant} />
                  </>
                ) : (
                  dealerCards.slice(0, Math.max(revealStep, 2)).map((card, i) => (
                    <PlayingCard
                      key={`d${i}`}
                      card={card}
                      faceDown={i === 1 && holeHidden}
                      instant={instant}
                      delay={0}
                    />
                  ))
                )
              ) : (
                <span className="text-[#625F7E] text-sm">Place a bet to start</span>
              )}
            </div>
            {hand && <HandBadge label={dealerLabel} />}
          </div>

          <span className="text-[11px] text-[#625F7E] text-center py-3">
            Blackjack pays 3:2 · Dealer stands on soft 17 · Double on any two cards
          </span>

          {/* player */}
          <div className="flex flex-col items-center gap-3">
            {hand && playerHand && (
              <HandBadge
                label={totalLabel(playerHand.cards)}
                tone={phase === "settled" ? OUTCOME_TEXT[playerHand.outcome || ""] : undefined}
              />
            )}
            <div className="flex gap-2 min-h-[100px] items-center">
              {playerHand?.cards.map((card, i) => (
                <PlayingCard
                  key={`p${i}`}
                  card={card}
                  instant={instant}
                  delay={i < 2 ? i * 0.36 : 0}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-[#84819a]">You</span>
              {hand && (
                <span className="text-xs text-[#84819a]">
                  bet <Monetary value={playerHand?.bet ?? hand.betAmount} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => hand?.rollId && openRoll(hand.rollId)}
        disabled={!hand?.rollId}
        className="mt-4 text-xs text-[#625F7E] hover:text-[#84819a] disabled:cursor-default"
      >
        Provably fair · one seed per hand, one cursor per card
      </button>
    </div>
  );
};

export default BlackjackView;
