import { GiCardDraw, GiTwoCoins } from "react-icons/gi";
import { FaClone, FaHandPaper } from "react-icons/fa";
import GameLayout from "../../components/game/GameLayout";
import GameButton from "../../components/game/GameButton";
import BetAmount from "../../components/game/BetAmount";
import Monetary from "../../components/Monetary";
import PlayingCard from "./PlayingCard";
import { outcomeLabel, totalLabel } from "./blackjackCards";
import { BlackjackViewProps } from "./Blackjack.types";
import i18n from "../../i18n";

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
        {i18n.t("blackjack.blackjackPays3To")}
      </p>
      <p className="text-[10px] font-semibold tracking-[0.3em] text-[#625F7E] mt-1">
        {i18n.t("blackjack.dealerStandsOnSoft")}
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
  icon,
  iconColor,
  onClick,
  disabled,
  title,
}: {
  label: string;
  icon: React.ReactNode;
  iconColor: string;
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
    <span className={iconColor}>{icon}</span>
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
  split,
  insure,
  canHit,
  canStand,
  canDouble,
  canSplit,
  canInsure,
  awaitingInsurance,
  insuranceCost,
  openRoll,
}) => {
  const betting = phase === "idle" || phase === "settled";
  const totalStaked = hand ? hand.hands.reduce((s, h) => s + h.bet, 0) + hand.insuranceBet : 0;
  // one hand keeps its own outcome; a split summarizes the round in one line
  const settledOutcome =
    phase === "settled" && hand
      ? hand.hands.length === 1
        ? playerHand?.outcome
        : hand.totalPayout > totalStaked
          ? "win"
          : hand.totalPayout > 0
            ? "push"
            : "lose"
      : null;
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
    <GameLayout
      title={i18n.t("blackjack.blackjack")}
      footer={
        <button
          onClick={() => hand?.rollId && openRoll(hand.rollId)}
          disabled={!hand?.rollId}
          className="text-xs text-[#625F7E] hover:text-[#84819a] disabled:cursor-default"
        >
          {i18n.t("blackjack.provablyFairOneSeed")}
        </button>
      }
      panel={
        <>
          <BetAmount
            value={betInput}
            onChange={setBetInput}
            onBlur={normalizeBet}
            onHalve={halveBet}
            onDouble={doubleBet}
            onMax={maxOutBet}
            betValue={betValue}
            disabled={!betting || acting}
            hint={<>{i18n.t("common.balance")} <Monetary value={walletBalance} /></>}
          />

          {awaitingInsurance && (
            <div className="rounded-md bg-[#19172D] border border-[#2A2840] p-3 flex flex-col gap-2">
              <span className="text-sm font-bold text-center">
                Insurance? <span className="text-[#84819a] font-semibold">{i18n.t("blackjack.pays21")}</span>
              </span>
              <span className="text-xs text-[#84819a] text-center">
                costs <Monetary value={insuranceCost} />
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => insure(true)}
                  disabled={!canInsure}
                  className="min-h-[38px] rounded-md bg-[#4F46E5] hover:bg-indigo-500 font-bold text-sm disabled:opacity-40"
                >
                  {i18n.t("blackjack.accept")}
                </button>
                <button
                  onClick={() => insure(false)}
                  disabled={acting}
                  className="min-h-[38px] rounded-md bg-[#281D3F] hover:bg-[#3A2C5C] font-bold text-sm disabled:opacity-40"
                >
                  {i18n.t("blackjack.decline")}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <ActionButton label={i18n.t("blackjack.hit")} icon={<GiCardDraw size={18} />} iconColor="text-[#FFCC00]" onClick={hit} disabled={!canHit} />
            <ActionButton label={i18n.t("blackjack.stand")} icon={<FaHandPaper size={14} />} iconColor="text-[#A78BFA]" onClick={stand} disabled={!canStand} />
            <ActionButton label={i18n.t("blackjack.split")} icon={<FaClone size={13} />} iconColor="text-red-400" onClick={split} disabled={!canSplit} />
            <ActionButton label={i18n.t("blackjack.double")} icon={<GiTwoCoins size={17} />} iconColor="text-[#5EEAD4]" onClick={double} disabled={!canDouble} />
          </div>

          <GameButton onClick={() => deal()} disabled={!betting || acting || betValue > walletBalance}>
            {acting ? "Dealing..." : phase === "settled" ? "Rebet" : "Deal"}
          </GameButton>

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

          <div className="flex items-center justify-between text-xs text-[#84819a]">
            <span>{i18n.t("blackjack.instantReveal")}</span>
            <button
              role="switch"
              aria-checked={instant}
              aria-label={i18n.t("blackjack.instantReveal")}
              onClick={() => setInstant(!instant)}
              className={`relative w-9 h-5 rounded-full border border-[#2A2840] transition-colors ${
                instant ? "bg-[#4F46E5]" : "bg-[#19172D]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                  instant ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>

          {history.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-[#84819a]">{i18n.t("blackjack.history")}</span>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h) => (
                  <button
                    key={h.handId}
                    onClick={() => h.rollId && openRoll(h.rollId)}
                    title={h.rollId ? i18n.t("blackjack.verifyRoll", { id: h.rollId }) : i18n.t("blackjack.noRollId")}
                    className={`px-2 py-0.5 rounded text-xs font-semibold bg-[#19172D] border border-[#2A2840] hover:bg-[#281D3F] ${OUTCOME_TEXT[h.outcome || ""] || "text-white"}`}
                  >
                    {h.payout > 0 ? `+${h.payout}` : `-${h.betAmount}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      }
    >
      <div className="w-full rounded-lg p-4 sm:p-8 flex flex-col items-center justify-between min-h-[460px] sm:min-h-[540px] [background:radial-gradient(ellipse_at_50%_-20%,#2a2650_0%,#1a1830_55%,#151225_100%)]">
          {/* dealer */}
          <div className="flex flex-col items-center min-h-[170px] justify-start">
            {hand ? (
              <CardFan
                key={hand.handId}
                cards={dealerFan}
                holeHidden={holeHidden}
                badge={dealerBadge}
                instant={instant}
                baseDelay={hand.dealer.hidden ? 0.18 : 0}
                stagger={hand.dealer.hidden ? 0.36 : 0}
              />
            ) : (
              <span className="text-[#625F7E] text-sm mt-12">{i18n.t("blackjack.placeABetTo")}</span>
            )}
          </div>

          <Ribbon />

          {/* player: one fan per hand, the active split hand highlighted */}
          <div className="flex flex-col items-center min-h-[190px] justify-start">
            {hand ? (
              <div className="flex gap-8 sm:gap-12 items-start">
                {hand.hands.map((h, i) => {
                  const isActive =
                    hand.status === "active" && !hand.awaitingInsurance && i === hand.activeHandIndex;
                  const dimmed = hand.hands.length > 1 && hand.status === "active" && !isActive;
                  return (
                    <div
                      key={`${hand.handId}-hand${i}`}
                      className={`flex flex-col items-center transition-opacity ${dimmed ? "opacity-60" : ""}`}
                    >
                      <CardFan
                        cards={h.cards}
                        badge={totalLabel(h.cards)}
                        badgeTone={phase === "settled" ? OUTCOME_BADGE[h.outcome || ""] : undefined}
                        instant={instant}
                        baseDelay={0}
                        stagger={hand.hands.length === 1 ? 0.36 : 0}
                      />
                      {/* straight accent bar marks the hand in play (house rule: never rounded) */}
                      {hand.hands.length > 1 && (
                        <div className={`w-16 h-0.5 mt-2 ${isActive ? "bg-[#4F46E5]" : "bg-transparent"}`} />
                      )}
                      <span className="mt-2 text-xs text-[#84819a]">
                        bet <Monetary value={h.bet} />
                        {h.doubled && <span className="text-[#5EEAD4] font-semibold"> · doubled</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span />
            )}
            {hand && hand.insuranceBet > 0 && (
              <span className="mt-2 text-xs text-[#84819a]">
                insurance <Monetary value={hand.insuranceBet} />
              </span>
            )}
        </div>
      </div>
    </GameLayout>
  );
};

export default BlackjackView;
