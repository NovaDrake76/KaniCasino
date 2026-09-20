import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowLeft, FiX } from "react-icons/fi";
import { FaGift } from "react-icons/fa";
import DaisuArt from "./DaisuArt";
import JarReadout from "./JarReadout";
import SpeechBubble from "./SpeechBubble";
import RoadmapPanel from "./roadmap/RoadmapPanel";
import ShopShelf from "./shop/ShopShelf";
import YourBonus from "./YourBonus";
import type { DaisuViewProps } from "./Daisu.types";
import i18n from "../../i18n";

const DaisuRoomView: React.FC<DaisuViewProps> = ({
  backToPopup,
  closeToBubble,
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
  expression,
  shaking,
  hopping,
  bonuses,
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

      <div className="grid gap-6 md:grid-cols-[20rem_minmax(0,1fr)] md:gap-8">
        <section className="flex flex-col gap-4">
          {!touring && <SpeechBubble line={line} />}
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-4 md:grid-cols-1">
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
              className="mx-auto w-full max-w-[20rem]"
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
          </div>
          <YourBonus bonuses={bonuses} pick={bonusGame} sharePct={creditSharePct} onGo={closeToBubble} />
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
          <ShopShelf shop={shop} onPick={pickItem} />
          <RoadmapPanel
            roadmap={roadmap}
            claimingMission={claimingMission}
            helpKey={helpKey}
            bonusGame={bonusGame}
            onClaim={claimMission}
            onHelp={toggleHelp}
            onShowMe={showMe}
          />
        </section>
      </div>
    </div>
  </motion.div>
);

export default DaisuRoomView;
