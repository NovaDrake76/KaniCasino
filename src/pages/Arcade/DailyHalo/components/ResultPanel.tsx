import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiCheck, FiClock, FiCopy } from "react-icons/fi";
import { GiBrokenHeart, GiPartyPopper } from "react-icons/gi";
import Monetary from "../../../../components/Monetary";
import type { HaloAnswer } from "../../../../services/arcade/DailyHaloService";
import { academyLogo } from "../dailyHalo.logic";
import StudentPortrait from "./StudentPortrait";
import i18n from "../../../../i18n";

interface Props {
  won: boolean;
  answer: HaloAnswer;
  guessCount: number;
  maxGuesses: number;
  reward: number;
  adopted: boolean;
  streak: number;
  signedIn: boolean;
  bestReward: number;
  signIn: () => void;
  share: () => void;
  copied: boolean;
  clock: string;
}

const ResultPanel = ({
  won,
  answer,
  guessCount,
  maxGuesses,
  reward,
  adopted,
  streak,
  signedIn,
  bestReward,
  signIn,
  share,
  copied,
  clock,
}: Props) => {
  const logo = academyLogo(answer.academy);
  const caseLink = answer.card ? `/case/${answer.card.caseSlug || answer.card.caseId}` : null;

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45 }}
      className="mb-8"
    >
      <div
        className={`relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-2xl md:p-8 ${
          won ? "bg-gradient-to-br from-blue-500 to-cyan-400" : "bg-gradient-to-br from-red-500 to-pink-500"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[url('/images/arcade/halo-bg.webp')] bg-cover opacity-10 mix-blend-overlay" />

        <div className="relative">
          <h2 className="m-0 mb-2 flex items-center justify-center gap-3 text-3xl font-black uppercase italic tracking-tighter drop-shadow-md md:text-5xl">
            {won ? <GiPartyPopper className="flex-shrink-0 text-amber-200" /> : <GiBrokenHeart className="flex-shrink-0 text-pink-100" />}
            <span className="inline-block [transform:skewX(-9deg)]">{won ? i18n.t("arcade.halo.wonTitle", { name: answer.name }) : i18n.t("arcade.halo.lostCheer")}</span>
          </h2>
          <p className="m-0 mb-8 text-lg font-medium opacity-90 md:text-xl">
            {won
              ? `${i18n.t("arcade.halo.wonCheer")} ${i18n.t("arcade.halo.wonLine", { count: guessCount, max: maxGuesses })}`
              : i18n.t("arcade.halo.lostTitle", { name: answer.name })}
          </p>

          <div className="mb-6 inline-flex flex-col items-center rounded-2xl bg-white/20 p-6 backdrop-blur-md">
            <div className="relative mb-6">
              <div className={`absolute inset-0 rounded-full opacity-40 blur-2xl ${won ? "bg-white" : "bg-red-500"}`} />
              <StudentPortrait variant="hero" src={answer.studentImage} name={answer.name} dim={!won} className="relative" />
              {logo && (
                <div className="absolute -bottom-2 -right-2 flex h-14 w-14 items-center justify-center rounded-full bg-white p-2 shadow-lg">
                  <img src={logo} alt={answer.academy} className="h-full w-full object-contain" />
                </div>
              )}
            </div>
            <div className="text-2xl font-black uppercase tracking-wider">{answer.name}</div>
            <div className="text-sm font-bold uppercase tracking-widest opacity-75">{answer.academy}</div>
            {answer.voiceline && <audio controls src={answer.voiceline} className="mt-4 rounded-xl opacity-90 shadow-lg transition-opacity hover:opacity-100" />}
          </div>

          {won && signedIn && reward > 0 && (
            <div className="mx-auto mb-4 flex max-w-md flex-wrap items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3 text-slate-700 shadow-lg">
              <span className="text-2xl font-black text-amber-500">
                +<Monetary value={reward} />
              </span>
              <span className="text-sm font-semibold">
                {streak > 1 ? i18n.t("arcade.halo.rewardStreak", { count: streak }) : i18n.t("arcade.halo.rewardLine")}
              </span>
            </div>
          )}
          {won && signedIn && adopted && <p className="m-0 mb-4 text-xs font-semibold opacity-80">{i18n.t("arcade.halo.adoptedNote")}</p>}
          {!signedIn && (
            <div className="mx-auto mb-4 flex max-w-lg flex-wrap items-center justify-center gap-3 rounded-2xl bg-white/20 px-5 py-3 backdrop-blur-sm">
              <span className="text-sm font-semibold">{i18n.t("arcade.halo.signInLine", { amount: bestReward.toLocaleString("en-US") })}</span>
              <button
                type="button"
                onClick={signIn}
                className="rounded-xl border-none bg-white px-5 py-2 text-sm font-black uppercase tracking-wider text-blue-600 shadow-lg hover:border-none hover:bg-blue-50"
              >
                {i18n.t("arcade.halo.signIn")}
              </button>
            </div>
          )}

          {answer.card && caseLink && (
            <Link
              to={caseLink}
              className="group mx-auto mb-6 flex max-w-lg items-center gap-4 rounded-2xl bg-white/10 p-3 text-left text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <img src={answer.card.image} alt={answer.card.name} className="h-20 w-16 flex-shrink-0 rounded-md object-contain" />
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-bold">{i18n.t("arcade.halo.cardLine", { name: answer.card.name, case: answer.card.caseTitle })}</span>
                <span className="text-xs opacity-80">{i18n.t("arcade.halo.cardHint")}</span>
              </span>
              <span className="rounded-xl bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-blue-600 shadow group-hover:bg-blue-50">
                {i18n.t("arcade.halo.openCase")}
              </span>
            </Link>
          )}

          <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
            <button
              type="button"
              onClick={share}
              className="flex items-center gap-2 rounded-xl border-none bg-white px-8 py-3 font-black uppercase tracking-wider text-blue-600 shadow-lg transition-transform hover:border-none hover:bg-blue-50 active:scale-95"
            >
              {copied ? <FiCheck /> : <FiCopy />} {copied ? i18n.t("arcade.halo.copied") : i18n.t("arcade.halo.share")}
            </button>
            <span className="flex items-center gap-2 text-sm font-bold opacity-90">
              <FiClock /> {i18n.t("arcade.halo.nextStudent")} <span className="font-mono">{clock}</span>
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default ResultPanel;
