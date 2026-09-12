import { motion } from "framer-motion";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import type { GuessRow, MatchKey, MatchStatus } from "../../../../services/arcade/DailyHaloService";
import { academyLogo, MATCH_KEYS } from "../dailyHalo.logic";
import StudentPortrait from "./StudentPortrait";
import i18n from "../../../../i18n";

interface Props {
  rows: GuessRow[];
}

const TONE: Record<MatchStatus, string> = {
  CORRECT: "border-emerald-400/70 bg-emerald-500/15 text-emerald-100",
  WRONG: "border-red-400/50 bg-red-500/10 text-red-100",
  HIGHER: "border-amber-400/70 bg-amber-500/15 text-amber-100",
  LOWER: "border-amber-400/70 bg-amber-500/15 text-amber-100",
};

const valueOf = (row: GuessRow, key: MatchKey): string => {
  const s = row.student;
  if (key === "rarity") return "★".repeat(s.rarity || 0);
  if (key === "height") return s.height > 0 ? `${s.height} cm` : "?";
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
      transition={{ delay: index * 0.07, duration: 0.3 }}
      title={`${i18n.t(`arcade.halo.attr.${attr}`)}: ${i18n.t(`arcade.halo.status.${status}`)}`}
      className={`relative flex min-h-[4.5rem] flex-col items-center justify-center overflow-hidden border px-1 py-2 text-center ${TONE[status]}`}
    >
      {logo && <img src={logo} alt="" className="pointer-events-none absolute inset-0 m-auto h-14 w-14 object-contain opacity-10 grayscale" />}
      <span className="relative text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {i18n.t(`arcade.halo.attr.${attr}`)}
      </span>
      <span className="relative flex items-center gap-1 text-xs font-bold leading-tight md:text-sm">
        {valueOf(row, attr)}
        {status === "HIGHER" && <FiArrowUp aria-label={i18n.t("arcade.halo.status.HIGHER")} />}
        {status === "LOWER" && <FiArrowDown aria-label={i18n.t("arcade.halo.status.LOWER")} />}
      </span>
    </motion.div>
  );
};

const GuessRows = ({ rows }: Props) => (
  <div className="flex flex-col gap-3">
    {rows.map((row) => (
      <div key={row.student.name} className="flex flex-col gap-2 bg-surface p-3 md:flex-row md:items-stretch">
        <div className="flex items-center gap-3 md:w-40 md:flex-shrink-0 md:flex-col md:items-start md:justify-center">
          <StudentPortrait face src={row.student.studentImage} name={row.student.name} className="h-14 w-14" />
          <span className={`text-sm font-bold ${row.correct ? "text-emerald-300" : "text-ink"}`}>{row.student.name}</span>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1.5 [perspective:600px] sm:grid-cols-5 md:grid-cols-9">
          {MATCH_KEYS.map((attr, i) => (
            <Cell key={attr} row={row} attr={attr} index={i} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default GuessRows;
