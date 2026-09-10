import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowLeft, FiX } from "react-icons/fi";
import { FaGift } from "react-icons/fa";
import Monetary from "../Monetary";
import MissionCard from "../../pages/Missions/components/MissionCard";
import DaisuArt from "./DaisuArt";
import JarReadout from "./JarReadout";
import SpeechBubble from "./SpeechBubble";
import type { DaisuViewProps } from "./Daisu.types";
import i18n from "../../i18n";

const tabClass = (active: boolean) =>
  `border-none bg-transparent px-3 py-2 text-sm font-semibold hover:border-none ${
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
  pops,
  line,
  face,
  shaking,
  credits,
  pickName,
  pickPath,
  nextPickName,
  pickProgress,
  pickRemaining,
  groups,
  caseImage,
  claimAsk,
  visitAsk,
  claimingMission,
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
          <SpeechBubble line={line} />
          <DaisuArt
            fill={fill}
            face={face}
            shaking={shaking}
            pops={pops}
            onJar={takeFromJar}
            onPoke={poke}
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
            {credits.map((c) => (
              <div key={c.game} className="flex items-center justify-between bg-surface-raised px-3 py-1.5 text-sm">
                <span>
                  <span className="font-semibold text-accent-gold">
                    <Monetary value={c.amount} />
                  </span>{" "}
                  <span className="text-ink-soft">{i18n.t("daisu.onlyOn", { game: c.name })}</span>
                </span>
                <Link to={c.path} className="bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4338CA]">
                  {i18n.t("daisu.play")}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          {giftReady && (
            <Link
              to="/gift"
              onClick={closeToBubble}
              className="flex items-center justify-between bg-accent-gold px-4 py-3 text-sm font-bold text-[#2a2100] hover:bg-accent-amber"
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
            <button type="button" onClick={() => setTab("boosts")} className={tabClass(tab === "boosts")}>
              {i18n.t("daisu.tabBoosts")}
            </button>
          </div>

          {tab === "missions" ? (
            <div className="flex flex-col gap-6">
              {groups.map((g) => (
                <div key={g.key} className="flex flex-col gap-2">
                  <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">{g.label}</h2>
                  {g.missions.map((m) => (
                    <MissionCard
                      key={m.key}
                      mission={m}
                      claiming={claimingMission === m.key}
                      claim={claimAsk}
                      visit={visitAsk}
                      caseImage={caseImage}
                      endgame={g.key === "endgame"}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 bg-surface p-4">
              <p className="m-0 text-sm text-ink-soft">{i18n.t("daisu.lines.boostsEmpty.0")}</p>
              <p className="m-0 text-xs text-ink-muted">{i18n.t("daisu.boostsSoon")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  </motion.div>
);

export default DaisuRoomView;
