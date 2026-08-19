import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import Title from "../../components/Title";
import Roulette from "../../components/Roulette";
import GameButton from "../../components/game/GameButton";
import { boost, countdown, kp } from "./Gift.services";
import type { GiftViewProps, TopSlotRung } from "./Gift.types";
import i18n from "../../i18n";

const useTick = () => {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
};

// counts the reel's figure up to what the level multiplied it to, so the player watches
// their level do the work instead of reading about it
const usePump = (from: number, to: number, run: boolean) => {
  const [shown, setShown] = useState(from);
  useEffect(() => {
    if (!run || to <= from) return setShown(to);
    setShown(from);
    let id: ReturnType<typeof setInterval>;
    // the case lands first, then the level visibly pushes the number up
    const hold = setTimeout(() => {
      const started = Date.now();
      id = setInterval(() => {
        const t = Math.min(1, (Date.now() - started) / 1100);
        setShown(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
        if (t >= 1) clearInterval(id);
      }, 40);
    }, 600);
    return () => {
      clearTimeout(hold);
      clearInterval(id);
    };
  }, [from, to, run]);
  return shown;
};

// the top slot is drawn on every spin, so the row runs across its rungs and settles on
// the one that came up, 1x included
const useTopSlotCursor = (count: number, spinning: boolean, landedAt: number | null) => {
  const [cursor, setCursor] = useState(-1);
  useEffect(() => {
    if (landedAt !== null) return setCursor(landedAt);
    if (!spinning || count === 0) return setCursor(-1);
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setCursor(step % count);
      step += 1;
      // from a blur to a crawl, so it reads as running down rather than stopping dead
      timer = setTimeout(tick, 70 + step * 6);
    };
    tick();
    return () => clearTimeout(timer);
  }, [count, spinning, landedAt]);
  return cursor;
};

interface RungProps {
  rung: TopSlotRung;
  charging: boolean;
  active: boolean;
  landed: boolean;
}

const rungEdge = (rung: TopSlotRung, active: boolean, landed: boolean) => {
  if (landed) return "#FFCC00";
  if (active) return "#FFFFFF";
  if (rung.locked) return "#2A2840";
  return rung.multiplier > 1 ? "#4F46E5" : "#3A365A";
};

const Rung = ({ rung, charging, active, landed }: RungProps) => (
  <div
    className={`flex-1 py-3 text-center transition-all ${rung.locked && !active && !landed ? "opacity-50" : ""} ${
      charging && !rung.locked && rung.multiplier > 1 ? "gift-charge" : ""
    } ${landed ? "gift-slam bg-[#2a2340]" : active ? "-translate-y-1 bg-[#241f3b]" : "bg-surface-nav"}`}
    style={{ borderTop: `3px solid ${rungEdge(rung, active, landed)}` }}
  >
    <div
      className={`text-lg font-extrabold ${
        landed || active ? "text-white" : rung.locked || rung.multiplier === 1 ? "text-ink-faint" : "text-white"
      }`}
    >
      {rung.multiplier}x
    </div>
    <div className="mt-0.5 text-[10px] text-ink-muted">
      {rung.locked ? i18n.t("gift.levelLocked", { level: rung.minLevel }) : rung.multiplier === 1 ? "no bonus" : `${rung.chance}%`}
    </div>
  </div>
);

const GiftView = ({
  loading,
  state,
  stage,
  category,
  reel,
  landing,
  spinning,
  pending,
  result,
  onPick,
  onBack,
  onSpin,
  onOpen,
}: GiftViewProps) => {
  useTick();
  const pumped = usePump(result?.won.opens ?? 0, result?.opens ?? 0, !!result);
  const rungs = state?.topSlot || [];
  const landedAt = result ? rungs.findIndex((r) => r.multiplier === result.topSlot.multiplier) : -1;
  const cursor = useTopSlotCursor(
    rungs.filter((r) => !r.locked).length,
    stage === "spinning",
    landedAt >= 0 ? landedAt : null
  );

  if (loading) {
    return (
      <div className="w-full max-w-[1312px] p-8">
        <Skeleton height={420} baseColor="#1c1a31" highlightColor="#161427" />
      </div>
    );
  }
  if (!state) return <span className="p-8 text-ink-muted">{i18n.t("gift.couldNotLoadYour")}</span>;

  const pips = Array.from({ length: state.streakMax }, (_, i) => i < state.streak);
  const atBestStreak = state.streak >= state.streakMax;

  return (
    <div className="flex w-full max-w-[1312px] flex-col items-center px-4 pb-16 md:px-8">
      <style>{`
        @keyframes giftCharge {
          0%, 100% { transform: translateY(0); box-shadow: none; }
          50% { transform: translateY(-4px); box-shadow: 0 0 22px 0 rgba(236,168,35,0.45); }
        }
        .gift-charge { animation: giftCharge 1.6s ease-in-out infinite; }
        @keyframes giftSlam {
          0% { transform: scale(2.4); opacity: 0; }
          45% { transform: scale(0.92); opacity: 1; }
          65% { transform: scale(1.06); }
          100% { transform: scale(1); opacity: 1; }
        }
        .gift-slam { animation: giftSlam 700ms cubic-bezier(0.2, 0, 0.1, 1) both; }
        @keyframes giftFlare { from { opacity: 0; } to { opacity: 0.6; } }
        .gift-flare { animation: giftFlare 900ms ease-out both; }
      `}</style>

      <Title title={i18n.t("nav.dailyGift")} />

      <div className="mb-8 grid w-full grid-cols-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="notched flex flex-col gap-4 bg-surface p-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">{i18n.t("gift.streak")}</span>
            <span className="text-[11px] text-ink-faint">
              {atBestStreak ? (
                <b className="text-accent-gold">{i18n.t("gift.fullStreak")}</b>
              ) : (
                <>
                  day <b className="text-ink-soft">{state.streak}</b> of {state.streakMax}
                </>
              )}
            </span>
          </div>

          <div className="flex gap-1.5">
            {pips.map((lit, i) => (
              <div key={i} className={`h-1.5 flex-1 ${lit ? "bg-accent-amber" : "bg-line"}`} />
            ))}
          </div>

          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            {i18n.t("gift.rarePrizesLikelier")}
          </span>
          <div className={`flex items-end ${atBestStreak ? "justify-center" : "justify-between"}`}>
            <div className={`flex flex-col gap-1 ${atBestStreak ? "items-center" : ""}`}>
              <span
                className={`text-4xl font-extrabold leading-none ${
                  atBestStreak ? "text-accent-gold" : "text-accent-amber"
                }`}
              >
                {boost(state.rareBoost)}
              </span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">{i18n.t("gift.now")}</span>
            </div>
            {!atBestStreak && (
              <>
                <span className="pb-4 text-xl text-line-strong">&rarr;</span>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-4xl font-extrabold leading-none text-accent-gold">
                    {boost(state.atBestStreak.rareBoost)}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    day {state.streakMax}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="notched flex flex-col gap-3 bg-surface p-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">{i18n.t("gift.topSlot")}</span>
            <span className="text-[11px] text-ink-faint">
              your level <b className="text-ink-soft">{state.level}</b>
            </span>
          </div>
          <div className="flex gap-2">
            {state.topSlot.map((r, i) => (
              <Rung
                key={r.multiplier}
                rung={r}
                charging={stage === "charging"}
                active={cursor === i && stage === "spinning"}
                landed={cursor === i && stage === "won"}
              />
            ))}
          </div>
          <span className="text-[13px] text-ink-muted">
            {i18n.t("gift.multipliesWhateverTheReel")}
          </span>
        </div>
      </div>

      {!state.canSpin && stage === "picking" && (
        <div className="notched mb-8 flex w-full flex-col items-center gap-2 bg-surface p-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">{i18n.t("gift.nextGiftIn")}</span>
          <span className="font-mono text-3xl font-bold text-accent-gold">
            {countdown(state.nextAt) || "any moment"}
          </span>
        </div>
      )}

      {stage === "picking" && state.canSpin && (
        <>
          <div className="mb-3 w-full text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            {i18n.t("gift.chooseACollection")}
          </div>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.categories.map((c) => (
              <div key={c.category} className="notched group bg-line p-px transition-colors hover:bg-accent-gold">
                <div className="notched flex h-full flex-col gap-4 bg-surface p-5">
                  <div className="flex h-28 items-center justify-center bg-surface-nav">
                    <img
                      src={c.cover}
                      alt={c.category}
                      className="h-24 object-contain transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[17px] font-bold">{c.category}</span>
                    <span className="text-xs text-ink-faint">{c.eligible} cases in the pool</span>
                  </div>
                  <div className="mt-auto">
                    <GameButton onClick={() => onPick(c.category)}>{i18n.t("gift.spin")}</GameButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {stage !== "picking" && category && (
        <div className="flex w-full flex-col gap-6">
          <div className="flex items-center justify-between text-[13px] text-ink-muted">
            <button onClick={onBack} className="bg-transparent transition-colors hover:text-white" disabled={spinning}>
              &larr; Collections <span className="text-line-strong">/</span>{" "}
              <span className="font-semibold text-white">{category.category}</span>
            </button>
            <span>
              Streak <b className="text-accent-amber">{state.streak}</b>
            </span>
          </div>

          {stage !== "won" && (
            <div className="relative flex h-72 items-center justify-center overflow-hidden border-y-4 border-[#16152c] bg-surface-deep">
            <Roulette
              items={reel}
              openedItem={landing || reel[0]}
              spin={spinning}
              overlay={(item) => (
                <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
                  <span className="text-xl font-extrabold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
                    {item.name.split(" ")[0]}
                  </span>
                </div>
              )}
            />
            <div className="absolute inset-y-0 left-1/2 z-20 -ml-px w-0.5 bg-[#CF3464]" />
            </div>
          )}

          {stage === "charging" && (
            <div className="flex flex-col items-center gap-3">
              <span className="text-[13px] text-ink-muted">
                {i18n.t("gift.yourStreakIsCharging")}
              </span>
              <div className="w-full max-w-xs">
                <GameButton onClick={onSpin} disabled={pending || spinning}>
                  {i18n.t("gift.spinTheDailyGift")}
                </GameButton>
              </div>
            </div>
          )}

          {stage === "won" && result && (
            <div className="flex flex-col items-center gap-10 py-8">
              <div className="animate-fade-in relative flex items-center justify-center">
                <img
                  src={result.won.image}
                  alt={result.won.title}
                  className="h-32 w-32 object-contain md:h-48 md:w-48"
                />
                <div
                  className="notched absolute left-[210px] z-20 hidden h-48 w-48 animate-fade-in-left items-center justify-center md:flex"
                  style={{ background: result.topSlot.hit ? "#FFCC00" : "#3A365A" }}
                >
                  <div className="notched z-30 flex h-[184px] w-[184px] flex-col items-center justify-center gap-1 bg-[#151225] px-3 text-center">
                    <span className="text-xl font-bold text-[#e1dde9]">{result.won.title}</span>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">{i18n.t("gift.theReelGave")}</span>
                    <span className="text-3xl font-extrabold leading-none">{result.won.opens}x</span>
                    <span
                      className={`text-sm font-bold ${result.topSlot.hit ? "text-accent-gold" : "text-ink-muted"}`}
                    >
                      top slot {result.topSlot.multiplier}x
                    </span>
                  </div>
                </div>
              </div>

              <div className="animate-fade-in-down flex flex-col items-center gap-2">
                <span
                  className={`gift-slam px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] ${
                    result.topSlot.hit ? "bg-accent-gold text-[#2a2100]" : "bg-line-strong text-ink-soft"
                  }`}
                >
                  {result.topSlot.hit
                    ? i18n.t("gift.topSlotBadge", { level: state.level, multiplier: result.topSlot.multiplier })
                    : i18n.t("gift.topSlot1xNo")}
                </span>
                <div className="relative flex items-baseline gap-3">
                  {result.topSlot.hit && (
                    <div className="gift-flare pointer-events-none absolute -inset-8 bg-[radial-gradient(circle,rgba(255,204,0,0.22),transparent_68%)]" />
                  )}
                  <span className="relative text-6xl font-extrabold leading-none text-accent-gold">
                    {kp(pumped)}
                  </span>
                  <span className="relative text-xl font-bold">{i18n.t("gift.freeOpenings")}</span>
                </div>
                <span className="text-[13px] text-ink-muted">
                  Expires in <b className="text-ink-soft">{countdown(result.expiresAt) || "any moment"}</b>
                </span>
                {result.grantRemaining > result.opens && (
                  <span className="text-[13px] text-accent-amber">
                    {kp(result.grantRemaining)} waiting on this case in total
                  </span>
                )}
              </div>

              <div className="w-full max-w-xs">
                <GameButton onClick={() => onOpen(result.won.caseId)}>{i18n.t("gift.openThemNow")}</GameButton>
              </div>
            </div>
          )}
        </div>
      )}

      {state.grants.length > 0 && stage !== "won" && (
        <div className="notched mt-8 flex w-full flex-col gap-3 bg-surface p-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-gold">
            {i18n.t("gift.freeOpeningsWaiting")}
          </span>
          <div className="flex flex-wrap gap-3">
            {state.grants.map((g) => (
              <button
                key={g.grantId}
                onClick={() => onOpen(g.caseId)}
                className="flex items-center gap-3 border border-line bg-surface-nav px-4 py-3 text-left transition-colors hover:border-accent-gold"
              >
                <img src={g.image} alt={g.title} className="h-10 w-10 object-contain" loading="lazy" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">{g.title}</span>
                  <span className="text-[13px] text-accent-gold">
                    {g.remaining} {g.remaining === 1 ? "opening" : "openings"} left
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    expires in {countdown(g.expiresAt) || "moments"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftView;
