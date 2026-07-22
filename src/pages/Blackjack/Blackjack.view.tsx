import Title from "../../components/Title";
import Monetary from "../../components/Monetary";
import PlayingCard, { SuitIcon } from "./PlayingCard";
import { outcomeLabel, totalLabel } from "./blackjackCards";
import { BlackjackViewProps } from "./Blackjack.types";

const OUTCOME_TEXT: Record<string, string> = {
  blackjack: "text-[#FFCC00]",
  win: "text-green-400",
  push: "text-[#84819a]",
  lose: "text-red-400",
};

const OUTCOME_BADGE: Record<string, string> = {
  blackjack: "border-[#FFCC00] text-[#FFCC00]",
  win: "border-green-400 text-green-300",
  push: "border-[#3A365A] text-[#84819a]",
  lose: "border-red-400 text-red-300",
};

// overlapping fan with the value badge floating above, like a held hand
const CardFan = ({
  cards,
  holeHidden,
  badge,
  badgeTone,
  instant,
  baseDelay = 0,
  stagger = 0,
}: {
  cards: number[];
  holeHidden?: boolean;
  badge: string;
  badgeTone?: string;
  instant: boolean;
  baseDelay?: number;
  stagger?: number;
}) => (
  <div className="relative pt-9">
    <span
      className={`absolute top-0 left-1/2 -translate-x-1/2 z-20 px-3 py-0.5 rounded-full bg-[#141225] border text-sm font-bold ${badgeTone || "border-[#3A365A] text-white"}`}
    >
      {badge}
    </span>
    <div className="flex items-start">
      {cards.map((card, i) => (
        <div
          key={`c${i}`}
          className={i > 0 ? "-ml-9 sm:-ml-12" : ""}
          style={{ transform: `translateY(${(cards.length - 1 - i) * 9}px)`, zIndex: i }}
        >
          <PlayingCard
            card={card === -1 ? undefined : card}
            faceDown={card === -1 || (i === 1 && holeHidden)}
            instant={instant}
            delay={i < 2 ? baseDelay + i * stagger : 0}
          />
        </div>
      ))}
    </div>
  </div>
);

// the table centerpiece ribbon
const Ribbon = () => (
  <div className="flex items-center gap-3 py-6 select-none">
    <svg viewBox="0 0 28 24" className="w-5 text-[#2A2840]" aria-hidden="true">
      <path fill="currentColor" d="M10 2h6l-8 10 8 10h-6L2 12z" />
      <path fill="currentColor" opacity="0.5" d="M20 2h6l-8 10 8 10h-6l-8-10z" />
    </svg>
    <div className="text-center">
      <p className="text-[13px] font-extrabold tracking-[0.25em] text-[#C9C6DE]">
        BLACKJACK PAYS 3 TO 2
      </p>
      <p className="text-[10px] font-semibold tracking-[0.3em] text-[#625F7E] mt-1">
        DEALER STANDS ON SOFT 17
      </p>
    </div>
    <svg viewBox="0 0 28 24" className="w-5 text-[#2A2840] rotate-180" aria-hidden="true">
      <path fill="currentColor" d="M10 2h6l-8 10 8 10h-6L2 12z" />
      <path fill="currentColor" opacity="0.5" d="M20 2h6l-8 10 8 10h-6l-8-10z" />
    </svg>
  </div>
);

const ActionButton = ({
  label,
  suit,
  suitColor,
  onClick,
  disabled,
  title,
}: {
  label: string;
  suit: number;
  suitColor: string;
  onClick?: () => void;
  disabled: boolean;
  title?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="flex items-center justify-center gap-2 min-h-[46px] rounded-md bg-[#281D3F] hover:bg-[#3A2C5C] font-bold text-sm disabled:opacity-40 disabled:hover:bg-[#281D3F] transition-colors"
  >
    {label}
    <SuitIcon suit={suit} className={`w-3.5 ${suitColor}`} />
  </button>
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
  canHit,
  canStand,
  canDouble,
  openRoll,
}) => {
  const betting = phase === "idle" || phase === "settled";
  const settledOutcome = phase === "settled" ? playerHand?.outcome : null;
  const dealerCards = hand?.dealer.cards ?? [];
  const holeHidden = !!hand && (hand.dealer.hidden || revealStep < 2);
  const dealerFan = hand
    ? hand.dealer.hidden
      ? [dealerCards[0], -1]
      : dealerCards.slice(0, Math.max(revealStep, 2))
    : [];
  const dealerShown = hand && !hand.dealer.hidden ? dealerCards.slice(0, Math.max(revealStep, 1)) : [];
  const dealerBadge = !hand
    ? ""
    : holeHidden
      ? totalLabel([dealerCards[0]])
      : totalLabel(dealerShown.length > 1 ? dealerShown : dealerCards.slice(0, 2));

  return (
    <div className="w-full flex flex-col items-center py-6 px-3">
      <Title title="Blackjack" />
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-[1100px] mt-4">
        {/* control panel: one stable layout, actions always visible */}
        <div className="w-full lg:w-72 shrink-0 order-2 lg:order-1 bg-[#212031] rounded-lg p-4 flex flex-col gap-3 h-fit">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wider text-[#84819a]">Bet amount</label>
            <span className="text-xs text-[#84819a]">
              <Monetary value={walletBalance} />
            </span>
          </div>
          <div className="flex items-stretch bg-[#19172D] border border-[#2A2840] focus-within:border-indigo-500 rounded-md overflow-hidden">
            <span className="flex items-center pl-3 pr-1 text-[#FFCC00] font-extrabold text-sm">
              K₽
            </span>
            <input
              value={betInput}
              onChange={(e) => setBetInput(e.target.value)}
              onBlur={normalizeBet}
              disabled={!betting || acting}
              inputMode="numeric"
              className="flex-1 min-w-0 bg-transparent outline-none px-2 py-2.5 text-sm font-semibold disabled:opacity-60"
            />
            {[
              { label: "½", fn: halveBet },
              { label: "2×", fn: doubleBet },
              { label: "Max", fn: maxOutBet },
            ].map((b) => (
              <button
                key={b.label}
                onClick={b.fn}
                disabled={!betting || acting}
                className="px-3 border-l border-[#2A2840] text-sm font-bold text-[#C9C6DE] hover:bg-[#281D3F] disabled:opacity-40"
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ActionButton label="Hit" suit={0} suitColor="text-[#FFCC00]" onClick={hit} disabled={!canHit} />
            <ActionButton label="Stand" suit={2} suitColor="text-[#A78BFA]" onClick={stand} disabled={!canStand} />
            <ActionButton label="Split" suit={1} suitColor="text-red-400" disabled title="Split arrives soon" />
            <ActionButton label="Double" suit={3} suitColor="text-[#5EEAD4]" onClick={double} disabled={!canDouble} />
          </div>

          <button
            onClick={() => deal()}
            disabled={!betting || acting || betValue > walletBalance}
            className="min-h-[50px] rounded-md bg-green-600 hover:bg-green-500 font-extrabold text-base tracking-wide disabled:opacity-40 disabled:hover:bg-green-600 transition-colors"
          >
            {acting ? "Dealing..." : phase === "settled" ? "Rebet" : "Deal"}
          </button>

          {phase === "settled" && settledOutcome && (
            <div className="rounded-md bg-[#19172D] px-3 py-2 text-center">
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

          <label className="flex items-center gap-2 text-xs text-[#84819a] cursor-pointer">
            <input
              type="checkbox"
              checked={instant}
              onChange={(e) => setInstant(e.target.checked)}
              className="accent-indigo-600"
            />
            Instant reveal
          </label>

          {history.length > 0 && (
            <div className="flex flex-col gap-1">
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
        <div className="flex-1 order-1 lg:order-2 rounded-lg p-4 sm:p-8 flex flex-col items-center justify-between min-h-[460px] sm:min-h-[540px] [background:radial-gradient(ellipse_at_50%_-20%,#2a2650_0%,#1a1830_55%,#151225_100%)]">
          {/* dealer */}
          <div className="flex flex-col items-center min-h-[170px] justify-start">
            {hand ? (
              <CardFan
                cards={dealerFan}
                holeHidden={holeHidden}
                badge={dealerBadge}
                instant={instant}
                baseDelay={hand.dealer.hidden ? 0.18 : 0}
                stagger={hand.dealer.hidden ? 0.36 : 0}
              />
            ) : (
              <span className="text-[#625F7E] text-sm mt-12">Place a bet to start</span>
            )}
          </div>

          <Ribbon />

          {/* player */}
          <div className="flex flex-col items-center min-h-[190px] justify-start">
            {hand && playerHand ? (
              <>
                <CardFan
                  cards={playerHand.cards}
                  badge={totalLabel(playerHand.cards)}
                  badgeTone={phase === "settled" ? OUTCOME_BADGE[playerHand.outcome || ""] : undefined}
                  instant={instant}
                  baseDelay={0}
                  stagger={0.36}
                />
                <span className="mt-4 text-xs text-[#84819a]">
                  bet <Monetary value={playerHand.bet} />
                  {playerHand.doubled && <span className="text-[#5EEAD4] font-semibold"> · doubled</span>}
                </span>
              </>
            ) : (
              <span />
            )}
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
