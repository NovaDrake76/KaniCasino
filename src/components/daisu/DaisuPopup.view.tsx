import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiChevronRight, FiX } from "react-icons/fi";
import { FaGift } from "react-icons/fa";
import { BsDoorOpen } from "react-icons/bs";
import BonusTicket from "./BonusTicket";
import DaisuArt from "./DaisuArt";
import JarReadout from "./JarReadout";
import SpeechBubble from "./SpeechBubble";
import type { DaisuViewProps } from "./Daisu.types";
import i18n from "../../i18n";

const spring = { type: "spring", stiffness: 420, damping: 32 } as const;

const DaisuPopupView: React.FC<DaisuViewProps> = ({
  closeToBubble,
  openRoom,
  fill,
  inJar,
  full,
  fresh,
  isFull,
  pending,
  untilFull,
  fullBonusPct,
  takeFromJar,
  poke,
  pokeLocked,
  touring,
  pops,
  run,
  settleMs,
  line,
  expression,
  shaking,
  hopping,
  bonuses,
  roadmap,
  giftReady,
  missionReady,
}) => (
  <motion.section
    initial={{ opacity: 0, y: 24, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={spring}
    aria-label="Daisu"
    data-tour="daisu-card"
    className="fixed bottom-4 right-4 z-sticky flex max-h-[calc(100vh-2rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto bg-surface shadow-2xl"
  >
    <header className="flex items-center justify-between border-b border-line px-4 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold">Daisu</span>
        <span className="text-xs text-ink-muted">{i18n.t("daisu.keeps")}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={openRoom}
          className="relative flex items-center gap-1.5 border-none bg-transparent px-2 py-1 text-xs text-ink-soft hover:border-none hover:text-ink"
        >
          <BsDoorOpen /> {i18n.t("daisu.visit")}
          {missionReady && <span className="absolute -right-0.5 top-0.5 h-2 w-2 bg-accent-gold" />}
        </button>
        <button
          type="button"
          onClick={closeToBubble}
          aria-label={i18n.t("daisu.close")}
          className="border-none bg-transparent p-1 text-ink-faint hover:border-none hover:text-ink-soft"
        >
          <FiX />
        </button>
      </div>
    </header>

    <div className="flex flex-col gap-3 px-4 pt-4">
      {!touring && <SpeechBubble line={line} />}
      <DaisuArt
        fill={fill}
        expression={expression}
        shaking={shaking}
        hopping={hopping}
        pops={pops}
        run={run}
        settleMs={settleMs}
        onJar={takeFromJar}
        onPoke={poke}
        pokeLocked={pokeLocked}
        jarLabel={i18n.t("daisu.jar")}
        pokeLabel="Daisu"
        className="mx-auto h-64"
      />
      <JarReadout
        inJar={inJar}
        full={full}
        fresh={fresh}
        fill={fill}
        isFull={isFull}
        untilFull={untilFull}
        fullBonusPct={fullBonusPct}
        pending={pending}
      />
    </div>

    <div className="flex flex-col gap-2 px-4 pb-4 pt-3">
      {bonuses
        .filter((b) => !b.expired)
        .map((b) => (
          <BonusTicket key={b.key} bonus={b} small />
        ))}
      {giftReady && (
        <Link
          to="/gift"
          onClick={closeToBubble}
          className="flex items-center justify-between bg-accent-gold px-3 py-2 text-sm font-bold text-[#2a2100] hover:bg-accent-amber hover:text-[#2a2100]"
        >
          <span className="flex items-center gap-2">
            <FaGift /> {i18n.t("daisu.giftReady")}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">{i18n.t("daisu.giftOpen")}</span>
        </Link>
      )}
      {roadmap && !roadmap.finished && (
        <button
          type="button"
          onClick={openRoom}
          className="flex w-full items-center justify-between gap-2 border-none bg-transparent px-0 py-1 text-left text-xs font-semibold text-ink-soft hover:border-none hover:text-ink focus:outline-none"
        >
          <span className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 ${missionReady ? "bg-accent-gold" : "bg-ink-faint"}`} />
            {i18n.t("daisu.missionsDone", {
              done: roadmap.missions.filter((m) => m.complete).length,
              total: roadmap.missions.length,
            })}
          </span>
          <FiChevronRight aria-hidden />
        </button>
      )}
    </div>
  </motion.section>
);

export default DaisuPopupView;
