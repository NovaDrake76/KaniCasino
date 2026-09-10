import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiCheck, FiX } from "react-icons/fi";
import { FaGift } from "react-icons/fa";
import { TailSpin } from "react-loader-spinner";
import Monetary from "../Monetary";
import DaisuMascot from "./DaisuMascot";
import type { DaisuViewProps } from "./Daisu.types";
import i18n from "../../i18n";

const spring = { type: "spring", stiffness: 420, damping: 32 } as const;

const DaisuDockView: React.FC<DaisuViewProps> = ({
  enabled,
  open,
  toggle,
  close,
  loaded,
  fill,
  amount,
  full,
  isFull,
  hasSomething,
  untilFloor,
  untilFull,
  claim,
  claiming,
  burst,
  clearBurst,
  line,
  face,
  shaking,
  credits,
  pickName,
  pickPath,
  creditShare,
  asks,
  claimAsk,
  claimingMission,
  attention,
  giftReady,
}) => {
  if (!enabled) return null;

  const pct = Math.round(fill * 100);

  return (
    <div className="fixed bottom-4 right-4 z-sticky max-w-[calc(100vw-2rem)]">
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.section
            key="card"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={spring}
            aria-label="Daisu"
            className="flex max-h-[calc(100vh-2rem)] w-[22rem] max-w-full flex-col overflow-y-auto bg-surface shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold">Daisu</span>
                <span className="text-xs text-ink-muted">{i18n.t("daisu.title")}</span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={i18n.t("daisu.close")}
                className="border-none bg-transparent p-1 text-ink-faint hover:border-none hover:text-ink-soft"
              >
                <FiX />
              </button>
            </header>

            <div className="flex gap-3 px-4 pt-3">
              <DaisuMascot fill={fill} face={face} shaking={shaking} className="-ml-2 h-44 w-36 flex-shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="relative bg-surface-nav px-3 py-2 text-sm leading-snug text-ink-soft">
                  <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-surface-nav" />
                  <motion.p
                    key={line ? line.key + JSON.stringify(line.vars ?? {}) : "none"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="relative m-0"
                  >
                    {line ? i18n.t(line.key, line.vars) : i18n.t("daisu.loading")}
                  </motion.p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-accent-gold">
                    <Monetary value={amount} />
                  </span>
                  <span className="text-xs text-ink-muted">
                    {i18n.t("daisu.ofFull", { full: full.toLocaleString("en-US") })}
                  </span>
                </div>
                <div className="h-2 w-full bg-surface-nav">
                  <div className="daisu-fill h-full bg-accent-gold" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>{isFull ? i18n.t("daisu.full") : i18n.t("daisu.fullIn", { clock: untilFull })}</span>
                  <span>{pct}%</span>
                </div>
              </div>
            </div>

            <div className="relative px-4 pb-3 pt-3">
              <button
                type="button"
                onClick={claim}
                disabled={!loaded || claiming}
                className={`flex h-11 w-full items-center justify-center gap-2 border-none text-sm font-bold transition-colors hover:border-none disabled:opacity-60 ${
                  hasSomething
                    ? "bg-accent-gold text-black hover:bg-accent-amber"
                    : "bg-surface-raised text-ink-soft hover:bg-surface-hover"
                }`}
              >
                {claiming ? (
                  <TailSpin height={18} width={18} color="#000" />
                ) : hasSomething ? (
                  <>
                    <span>{isFull ? i18n.t("daisu.takeAll") : i18n.t("daisu.take")}</span>
                    <Monetary value={amount} />
                  </>
                ) : (
                  <span>{i18n.t("daisu.nothingYet", { clock: untilFloor })}</span>
                )}
              </button>
              <AnimatePresence>
                {burst && (
                  <motion.div
                    key={burst.id}
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -56 }}
                    transition={{ duration: 1.6, times: [0, 0.15, 0.7, 1] }}
                    onAnimationComplete={clearBurst}
                    className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center"
                  >
                    <span className="text-xl font-extrabold text-accent-gold drop-shadow">
                      +<Monetary value={burst.amount} />
                    </span>
                    {burst.credit > 0 && (
                      <span className="text-xs font-semibold text-accent-light">
                        +<Monetary value={burst.credit} /> {burst.game}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-1 border-t border-line px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {i18n.t("daisu.creditsTitle")}
              </span>
              <span className="text-[11px] text-ink-muted">
                {i18n.t("daisu.pickToday", { game: pickName, share: Math.round(creditShare * 100) })}
              </span>
              {credits.length === 0 ? (
                <Link to={pickPath} className="text-xs text-ink-soft hover:text-ink">
                  {i18n.t("daisu.noCredit", { game: pickName })}
                </Link>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {credits.map((c) => (
                    <li key={c.game} className="flex items-center justify-between bg-surface-raised px-3 py-1.5 text-sm">
                      <span>
                        <span className="font-semibold text-accent-gold">
                          <Monetary value={c.amount} />
                        </span>{" "}
                        <span className="text-ink-soft">{i18n.t("daisu.onlyOn", { game: c.name })}</span>
                      </span>
                      <Link to={c.path} className="bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4338CA]">
                        {i18n.t("daisu.play")}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {asks.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {i18n.t("daisu.asks")}
                  </span>
                  <Link to="/missions" className="text-[11px] text-ink-muted hover:text-ink-soft">
                    {i18n.t("daisu.allMissions")}
                  </Link>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {asks.map((m) => {
                    const p = m.target > 0 ? Math.min(100, Math.round((m.current / m.target) * 100)) : 0;
                    return (
                      <li key={m.key} className="flex items-center gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm">{m.title}</span>
                            <span className="flex-shrink-0 text-xs font-semibold text-accent-gold">
                              <Monetary value={m.reward} />
                            </span>
                          </div>
                          <div className="h-1 w-full bg-surface-nav">
                            <div className="daisu-fill h-full bg-accent" style={{ width: `${p}%` }} />
                          </div>
                        </div>
                        {m.claimable && (
                          <button
                            type="button"
                            onClick={() => claimAsk(m.key)}
                            disabled={claimingMission === m.key}
                            className="flex h-8 flex-shrink-0 items-center gap-1 border-none bg-accent-gold px-2.5 text-xs font-bold text-black hover:border-none hover:bg-accent-amber disabled:opacity-60"
                          >
                            <FiCheck /> {i18n.t("daisu.collect")}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {giftReady && (
              <Link
                to="/gift"
                onClick={close}
                className="flex items-center gap-2 border-t border-line px-4 py-2 text-xs text-ink-soft hover:bg-surface-hover hover:text-ink"
              >
                <FaGift className="text-accent-gold" /> {i18n.t("gift.promptTitle")}
              </Link>
            )}
          </motion.section>
        ) : (
          <motion.button
            key="bubble"
            type="button"
            onClick={toggle}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={spring}
            aria-label={i18n.t("daisu.open")}
            className="flex items-center gap-2 border-none bg-surface py-1 pl-1 pr-3 text-left shadow-lg hover:border-none hover:bg-surface-hover"
          >
            <span className="relative">
              <DaisuMascot bust fill={fill} face={face} className="h-12 w-12" />
              {attention && (
                <span className="absolute -right-0.5 top-0 flex h-2.5 w-2.5">
                  <span className="absolute inset-0 animate-ping bg-accent-gold opacity-70" />
                  <span className="relative h-2.5 w-2.5 bg-accent-gold" />
                </span>
              )}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-accent-gold">
                <Monetary value={amount} />
              </span>
              <span className="mt-1 h-1 w-16 bg-surface-nav">
                <span className="daisu-fill block h-full bg-accent-gold" style={{ width: `${pct}%` }} />
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DaisuDockView;
