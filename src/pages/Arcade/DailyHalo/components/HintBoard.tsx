import { useState } from "react";
import { motion } from "framer-motion";
import { FiHelpCircle, FiLock, FiVolume2 } from "react-icons/fi";
import type { Hint, HintKey } from "../../../../services/arcade/DailyHaloService";
import i18n from "../../../../i18n";

interface Props {
  hints: Hint[];
  // guesses made so far: a row of hints only appears once its first hint is one miss away
  attempts: number;
}

const SPAN: Record<HintKey, string> = {
  halo: "col-span-1",
  hobby: "col-span-1 md:col-span-2",
  weapon: "col-span-2 md:col-span-1",
  profile: "col-span-2 md:col-span-4",
  gear: "col-span-1",
  voice: "col-span-1",
  club: "col-span-2 md:col-span-2",
};

const TINT: Partial<Record<HintKey, { box: string; label: string }>> = {
  hobby: { box: "bg-pink-50", label: "text-pink-400" },
  profile: { box: "bg-amber-50", label: "text-amber-500" },
  voice: { box: "bg-indigo-50", label: "text-indigo-400" },
  club: { box: "bg-purple-50", label: "text-purple-500" },
};

const IMAGE_HINTS = new Set<HintKey>(["halo", "weapon", "gear"]);

const Locked = ({ hint }: { hint: Hint }) => (
  <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center opacity-60">
    <FiLock className="mb-2 text-2xl text-slate-400" />
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {i18n.t("arcade.halo.lockedAfter", { count: hint.unlockAt })}
    </span>
  </div>
);

const Missing = ({ hint }: { hint: Hint }) => (
  <div className="flex flex-col items-center justify-center gap-1">
    <FiHelpCircle className="text-2xl text-slate-400" />
    <span className="text-center text-[10px] font-bold uppercase tracking-wider text-red-400">
      {hint.key === "halo" ? i18n.t("arcade.halo.noHalo") : i18n.t("arcade.halo.unavailable")}
    </span>
  </div>
);

// the halos are hotlinked from the wiki, which can drop a file; a broken one reads as missing
const ImageTile = ({ hint }: { hint: Hint }) => {
  const [broken, setBroken] = useState(false);
  const missing = !hint.available || !hint.image || broken;
  return (
    <div className="flex h-40 flex-col items-center justify-between rounded-2xl bg-white p-4 shadow-lg">
      <div className="mb-2 flex w-full flex-1 items-center justify-center overflow-hidden">
        {missing ? (
          <Missing hint={hint} />
        ) : (
          <img
            src={hint.image}
            alt={i18n.t(`arcade.halo.hint.${hint.key}`)}
            onError={() => setBroken(true)}
            className="h-full w-full rounded-md bg-slate-400 object-contain"
          />
        )}
      </div>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-500">
        {i18n.t(`arcade.halo.hint.${hint.key}`)}
      </span>
    </div>
  );
};

const TextTile = ({ hint }: { hint: Hint }) => {
  const tint = TINT[hint.key] || { box: "bg-slate-50", label: "text-slate-500" };
  return (
    <div className={`flex h-full min-h-[140px] flex-col items-center justify-center rounded-2xl p-4 text-center ${tint.box}`}>
      {hint.key === "voice" ? (
        <>
          <FiVolume2 className={`mb-2 text-2xl ${tint.label}`} />
          {hint.available && hint.audio ? (
            <audio controls src={hint.audio} className="mb-2 h-8 w-full max-w-[150px]" />
          ) : (
            <Missing hint={hint} />
          )}
          <span className={`rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${tint.label}`}>
            {i18n.t("arcade.halo.hint.voice")}
          </span>
        </>
      ) : hint.key === "profile" ? (
        <>
          <span className={`mb-1 block text-xs font-bold uppercase tracking-widest ${tint.label}`}>
            {i18n.t("arcade.halo.birthday", { date: hint.birthday })}
          </span>
          {hint.text && <p className="m-0 line-clamp-3 text-xs italic text-slate-600">&ldquo;{hint.text}&rdquo;</p>}
        </>
      ) : (
        <>
          <span className={`mb-1 block text-xs font-bold uppercase tracking-widest ${tint.label}`}>{i18n.t(`arcade.halo.hint.${hint.key}`)}</span>
          {hint.available && hint.text ? (
            <p className="m-0 text-sm font-bold leading-tight text-slate-700 md:text-base">{hint.text}</p>
          ) : (
            <p className="m-0 text-xs italic leading-tight text-slate-400">{i18n.t("arcade.halo.unavailable")}</p>
          )}
        </>
      )}
    </div>
  );
};

const HintBoard = ({ hints, attempts }: Props) => {
  const unlockOf = (key: HintKey) => hints.find((h) => h.key === key)?.unlockAt ?? Number.POSITIVE_INFINITY;
  const showRow2 = attempts >= unlockOf("profile") - 1;
  const showRow3 = attempts >= unlockOf("gear") - 1;
  const visible = hints.filter((h) => {
    if (h.key === "profile") return showRow2;
    if (h.key === "gear" || h.key === "voice" || h.key === "club") return showRow3;
    return true;
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative mb-8 overflow-hidden rounded-3xl bg-white/95 p-6 shadow-xl md:p-8"
    >
      <div className="pointer-events-none absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-gradient-to-br from-blue-100 to-transparent opacity-30" />
      <div className="relative mb-6 flex items-center justify-center gap-3">
        <div className="h-px w-12 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
        <h2 className="m-0 text-sm font-black uppercase tracking-widest text-blue-600">{i18n.t("arcade.halo.hintsTitle")}</h2>
        <div className="h-px w-12 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
      </div>
      <div className="relative grid grid-cols-2 gap-4 md:grid-cols-4">
        {visible.map((hint) => (
          <motion.div
            key={`${hint.key}-${hint.unlocked}`}
            initial={hint.unlocked ? { scale: 0.9, opacity: 0 } : { opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={SPAN[hint.key]}
          >
            {!hint.unlocked ? <Locked hint={hint} /> : IMAGE_HINTS.has(hint.key) ? <ImageTile hint={hint} /> : <TextTile hint={hint} />}
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default HintBoard;
