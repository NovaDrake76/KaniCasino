import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiCheck, FiCopy } from "react-icons/fi";
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`flex flex-col gap-5 border-t-4 bg-surface p-5 md:p-6 ${won ? "border-t-emerald-400" : "border-t-red-400"}`}
    >
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:text-left">
        <div className="relative">
          <StudentPortrait src={answer.studentImage} name={answer.name} dim={!won} className="h-32 w-32" />
          {logo && <img src={logo} alt={answer.academy} className="absolute -bottom-2 -right-2 h-10 w-10 object-contain drop-shadow" />}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="m-0 text-2xl font-extrabold md:text-3xl">
            {won ? i18n.t("arcade.halo.wonTitle", { name: answer.name }) : i18n.t("arcade.halo.lostTitle", { name: answer.name })}
          </h2>
          <p className="m-0 text-sm text-ink-soft">
            {won
              ? i18n.t("arcade.halo.wonLine", { count: guessCount, max: maxGuesses })
              : i18n.t("arcade.halo.lostLine")}
          </p>
          <p className="m-0 text-xs text-ink-muted">
            {answer.academy}, {answer.role}, {answer.type}
          </p>
          {answer.voiceline && <audio controls src={answer.voiceline} className="mt-2 h-9 w-full max-w-xs self-center md:self-start" />}
        </div>
      </div>

      {won && signedIn && reward > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-accent-gold/10 px-4 py-3">
          <span className="text-2xl font-extrabold text-accent-gold">
            +<Monetary value={reward} />
          </span>
          <span className="text-sm text-ink-soft">
            {streak > 1 ? i18n.t("arcade.halo.rewardStreak", { count: streak }) : i18n.t("arcade.halo.rewardLine")}
          </span>
        </div>
      )}
      {won && signedIn && adopted && <p className="m-0 text-xs text-ink-muted">{i18n.t("arcade.halo.adoptedNote")}</p>}
      {!signedIn && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#5CC8FF]/10 px-4 py-3">
          <span className="text-sm text-ink-soft">
            {i18n.t("arcade.halo.signInLine", { amount: bestReward.toLocaleString("en-US") })}
          </span>
          <button
            type="button"
            onClick={signIn}
            className="border-none bg-[#5CC8FF] px-4 py-2 text-sm font-bold text-[#04121c] hover:border-none hover:bg-[#8FDBFF]"
          >
            {i18n.t("arcade.halo.signIn")}
          </button>
        </div>
      )}

      {answer.card && caseLink && (
        <Link to={caseLink} className="group flex items-center gap-4 bg-surface-raised p-3 hover:bg-surface-hover">
          <img src={answer.card.image} alt={answer.card.name} className="h-20 w-16 flex-shrink-0 object-contain" />
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-ink">
              {i18n.t("arcade.halo.cardLine", { name: answer.card.name, case: answer.card.caseTitle })}
            </span>
            <span className="text-xs text-ink-muted">{i18n.t("arcade.halo.cardHint")}</span>
          </span>
          <span className="bg-accent px-3 py-2 text-xs font-bold text-white group-hover:bg-[#4338CA]">{i18n.t("arcade.halo.openCase")}</span>
        </Link>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={share}
          className="flex items-center gap-2 border-none bg-surface-raised px-4 py-2 text-sm font-semibold text-ink hover:border-none hover:bg-surface-hover"
        >
          {copied ? <FiCheck /> : <FiCopy />} {copied ? i18n.t("arcade.halo.copied") : i18n.t("arcade.halo.share")}
        </button>
        <span className="text-sm text-ink-muted">
          {i18n.t("arcade.halo.nextStudent")} <span className="font-mono font-bold text-[#5CC8FF]">{clock}</span>
        </span>
      </div>
    </motion.section>
  );
};

export default ResultPanel;
