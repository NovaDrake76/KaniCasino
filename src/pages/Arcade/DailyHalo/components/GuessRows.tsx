import { motion } from "framer-motion";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import type { GuessRow, MatchKey, MatchStatus } from "../../../../services/arcade/DailyHaloService";
import { academyLogo, MATCH_KEYS } from "../dailyHalo.logic";
import StudentPortrait from "./StudentPortrait";
import i18n from "../../../../i18n";

interface Props {
  rows: GuessRow[];
}

// the original's colours as fills: a coloured outline on a rounded box is off the table here
const TONE: Record<MatchStatus, string> = {
  CORRECT: "bg-emerald-100 text-emerald-900",
  WRONG: "bg-red-100 text-red-900",
  HIGHER: "bg-amber-100 text-amber-900",
  LOWER: "bg-amber-100 text-amber-900",
};

const valueOf = (row: GuessRow, key: MatchKey): string => {
  const s = row.student;
  if (key === "rarity") return "★".repeat(s.rarity || 0);
  if (key === "height") return s.height > 0 ? `${s.height}cm` : "?";
  const value = s[key];
  return value && value !== "Unknown" ? String(value) : "?";
};

const Cell = ({ row, attr, index }: { row: GuessRow; attr: MatchKey; index: number }) => {
  const status = row.matches[attr];
  const logo = attr === "academy" ? academyLogo(row.student.academy) : null;
  return (
    <motion.div
      initial={{ rotateX: 90, opacity: 0 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      title={`${i18n.t(`arcade.halo.attr.${attr}`)}: ${i18n.t(`arcade.halo.status.${status}`)}`}
      className={`relative flex h-full min-h-[70px] cursor-help flex-col items-center justify-center overflow-hidden rounded-xl p-2 shadow-sm transition-transform hover:scale-105 ${TONE[status]}`}
    >
      {logo && (
        <div className="pointer-events-none absolute flex h-full w-full scale-150 items-center justify-center opacity-10 grayscale">
          <img src={logo} alt="" className="h-full w-full object-contain" />
        </div>
      )}
      <span className="relative mb-1 text-[10px] font-bold uppercase tracking-wider opacity-60">{i18n.t(`arcade.halo.attr.${attr}`)}</span>
      <div className="relative flex items-center gap-1">
        <span className="truncate px-1 text-center text-xs font-black uppercase leading-tight md:text-sm">
          {valueOf(row, attr)}
          {logo && <img src={logo} alt="" className="-mt-1 ml-1 inline-block h-8 w-8 object-contain" />}
        </span>
        {status === "HIGHER" && <FiArrowUp className="animate-bounce text-lg" aria-label={i18n.t("arcade.halo.status.HIGHER")} />}
        {status === "LOWER" && <FiArrowDown className="animate-bounce text-lg" aria-label={i18n.t("arcade.halo.status.LOWER")} />}
      </div>
    </motion.div>
  );
};

const GuessRows = ({ rows }: Props) => (
  <div className="mx-auto max-w-6xl space-y-4">
    {rows.map((row) => (
      <motion.div
        key={row.student.name}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white p-4 shadow-lg"
      >
        <div className="mb-4 flex items-center gap-4 border-b border-slate-100 pb-3">
          <StudentPortrait variant="round" src={row.student.studentImage} name={row.student.name} />
          <p className={`m-0 text-lg font-black leading-none ${row.correct ? "text-emerald-600" : "text-slate-800"}`}>{row.student.name}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 [perspective:600px] md:grid-cols-10 [&>*]:col-span-1 md:[&>*]:col-span-2 md:[&>*:nth-child(6)]:col-start-2">
          {MATCH_KEYS.map((attr, i) => (
            <Cell key={attr} row={row} attr={attr} index={i} />
          ))}
        </div>
      </motion.div>
    ))}
  </div>
);

export default GuessRows;
