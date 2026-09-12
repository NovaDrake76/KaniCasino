import { useState } from "react";
import { motion } from "framer-motion";
import { FiLock } from "react-icons/fi";
import type { Hint } from "../../../../services/arcade/DailyHaloService";
import i18n from "../../../../i18n";

interface Props {
  hints: Hint[];
}

// text hints take two columns; the club closes the board on its own row
const SPAN: Record<string, string> = { hobby: "col-span-2", profile: "col-span-2", club: "col-span-2 md:col-span-4" };

const Locked = ({ hint }: { hint: Hint }) => (
  <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-ink-faint">
    <FiLock className="text-lg" />
    <span className="text-[11px] font-semibold uppercase tracking-wide">{i18n.t(`arcade.halo.hint.${hint.key}`)}</span>
    <span className="text-[11px]">{i18n.t("arcade.halo.lockedAfter", { count: hint.unlockAt })}</span>
  </div>
);

const Missing = ({ hint }: { hint: Hint }) => (
  <p className="m-0 text-center text-xs italic text-ink-muted">
    {hint.key === "halo" ? i18n.t("arcade.halo.noHalo") : i18n.t("arcade.halo.unavailable")}
  </p>
);

// the halos are hotlinked from the wiki, which can drop a file; a broken one reads as missing
const ImageHint = ({ hint }: { hint: Hint }) => {
  const [broken, setBroken] = useState(false);
  if (broken) return <Missing hint={hint} />;
  return (
    <img
      src={hint.image}
      alt={i18n.t(`arcade.halo.hint.${hint.key}`)}
      onError={() => setBroken(true)}
      className="max-h-24 w-full object-contain"
    />
  );
};

const Body = ({ hint }: { hint: Hint }) => {
  if (!hint.available) return <Missing hint={hint} />;
  if (hint.image) return <ImageHint hint={hint} />;
  if (hint.audio) return <audio controls src={hint.audio} className="h-9 w-full max-w-[16rem]" />;
  if (hint.key === "profile") {
    return (
      <div className="flex flex-col gap-1 text-center">
        <span className="text-xs font-semibold text-accent-gold">{i18n.t("arcade.halo.birthday", { date: hint.birthday })}</span>
        {hint.text && <p className="m-0 line-clamp-4 text-xs italic text-ink-soft">&ldquo;{hint.text}&rdquo;</p>}
      </div>
    );
  }
  return <p className="m-0 text-center text-sm font-semibold text-ink">{hint.text}</p>;
};

const HintBoard = ({ hints }: Props) => (
  <section className="flex flex-col gap-3">
    <h2 className="m-0 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#5CC8FF]">
      {i18n.t("arcade.halo.hintsTitle")}
    </h2>
    <div className="grid grid-flow-row-dense grid-cols-2 gap-2 md:grid-cols-4">
      {hints.map((hint) => (
        <motion.div
          key={`${hint.key}-${hint.unlocked}`}
          initial={hint.unlocked ? { scale: 0.92, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={`flex min-h-[8.5rem] flex-col gap-2 p-3 ${SPAN[hint.key] || ""} ${
            hint.unlocked ? "bg-surface" : "border border-dashed border-line bg-surface/40"
          }`}
        >
          {hint.unlocked ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5CC8FF]">
                {i18n.t(`arcade.halo.hint.${hint.key}`)}
              </span>
              <div className={`flex flex-1 items-center justify-center p-2 ${hint.image ? "bg-[#C9D6E3]" : ""}`}>
                <Body hint={hint} />
              </div>
            </>
          ) : (
            <Locked hint={hint} />
          )}
        </motion.div>
      ))}
    </div>
  </section>
);

export default HintBoard;
