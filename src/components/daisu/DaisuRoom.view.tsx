import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowLeft, FiX } from "react-icons/fi";
import { FaGift } from "react-icons/fa";
import BonusSection from "./BonusSection";
import DaisuArt from "./DaisuArt";
import JarReadout from "./JarReadout";
import SpeechBubble from "./SpeechBubble";
import RoadmapPanel from "./roadmap/RoadmapPanel";
import ShopPanel from "./shop/ShopPanel";
import type { DaisuViewProps } from "./Daisu.types";
import i18n from "../../i18n";

const tabClass = (active: boolean) =>
  `border-none bg-transparent px-3 py-2 text-sm font-semibold hover:border-none focus:outline-none ${
    active ? "border-b-2 border-b-accent text-ink" : "text-ink-muted hover:text-ink-soft"
  }`;

const DaisuRoomView: React.FC<DaisuViewProps> = ({
  backToPopup,
  closeToBubble,
  tab,
  setTab,
  fill,
  inJar,
  full,
  fresh,
  isFull,
  pending,
  untilFull,
  fullBonusPct,
  creditSharePct,
  takeFromJar,
  poke,
  pokeLocked,
  touring,
  pops,
  run,
  settleMs,
  line,
  face,
  shaking,
  bonuses,
  pickName,
  pickPath,
  nextPickName,
  pickProgress,
  pickRemaining,
  bonusGame,
  roadmap,
  claimingMission,
  claimMission,
  helpKey,
  toggleHelp,
  showMe,
  shop,
  pickItem,
  giftReady,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.2 }}
    role="dialog"
    aria-label={i18n.t("daisu.roomTitle")}
    className="fixed inset-0 z-modal overflow-y-auto bg-surface-page"
  >
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 md:px-8 md:py-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={backToPopup}
          className="flex items-center gap-2 border-none bg-transparent px-0 text-sm text-ink-soft hover:border-none hover:text-ink"
        >
          <FiArrowLeft /> {i18n.t("daisu.back")}
        </button>
        <h1 className="m-0 text-lg font-bold">{i18n.t("daisu.roomTitle")}</h1>
        <button
          type="button"
          onClick={closeToBubble}
          aria-label={i18n.t("daisu.close")}
          className="border-none bg-transparent p-1 text-xl text-ink-faint hover:border-none hover:text-ink-soft"
        >
          <FiX />
        </button>
      </header>

      <div className="grid gap-8 md:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          {!touring && <SpeechBubble line={line} />}
          <DaisuArt
            fill={fill}
            face={face}
            shaking={shaking}
            pops={pops}
            run={run}
            settleMs={settleMs}
            onJar={takeFromJar}
            onPoke={poke}
            pokeLocked={pokeLocked}
            jarLabel={i18n.t("daisu.jar")}
            pokeLabel="Daisu"
            className="mx-auto w-full max-w-[22rem]"
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
            big
          />

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{i18n.t("daisu.pickTitle")}</span>
            <Link to={pickPath} className="text-sm text-ink-soft hover:text-ink">
              {i18n.t("daisu.pickLine", { share: creditSharePct, game: pickName })}
            </Link>
            <div className="h-1.5 w-full bg-surface-nav">
              <div className="daisu-fill h-full bg-accent" style={{ width: `${Math.round(pickProgress * 100)}%` }} />
            </div>
            <span className="text-[11px] text-ink-muted">
              {i18n.t("daisu.nextPick", { game: nextPickName, amount: pickRemaining.toLocaleString("en-US") })}
            </span>
            <BonusSection bonuses={bonuses} />
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          {giftReady && (
            <Link
              to="/gift"
              onClick={closeToBubble}
              className="flex items-center justify-between bg-accent-gold px-4 py-3 text-sm font-bold text-[#2a2100] hover:bg-accent-amber hover:text-[#2a2100]"
            >
              <span className="flex items-center gap-2">
                <FaGift className="text-lg" /> {i18n.t("daisu.giftReady")}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide">{i18n.t("daisu.giftOpen")}</span>
            </Link>
          )}

          <div className="flex gap-2 border-b border-line">
            <button type="button" onClick={() => setTab("missions")} className={tabClass(tab === "missions")}>
              {i18n.t("daisu.tabMissions")}
            </button>
            <button type="button" onClick={() => setTab("shop")} className={tabClass(tab === "shop")}>
              {i18n.t("daisu.shop.tab")}
            </button>
          </div>

          {tab === "missions" ? (
            <RoadmapPanel
              roadmap={roadmap}
              claimingMission={claimingMission}
              helpKey={helpKey}
              bonusGame={bonusGame}
              onClaim={claimMission}
              onHelp={toggleHelp}
              onShowMe={showMe}
            />
          ) : (
            <ShopPanel shop={shop} onPick={pickItem} />
          )}
        </section>
      </div>
    </div>
  </motion.div>
);

export default DaisuRoomView;
