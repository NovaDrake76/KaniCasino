import { motion } from "framer-motion";
import type { Line } from "./Daisu.types";
import i18n from "../../i18n";

interface Props {
  line: Line | null;
  className?: string;
}

// what she is saying, with the tail pointing down at her
const SpeechBubble = ({ line, className }: Props) => (
  <div className={`relative bg-surface-nav px-3 py-2 text-sm leading-snug text-ink-soft ${className || ""}`}>
    <span className="absolute -bottom-1.5 left-8 h-3 w-3 rotate-45 bg-surface-nav" />
    <motion.p
      key={line ? line.key + JSON.stringify(line.vars ?? {}) : "none"}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="relative m-0"
    >
      {line ? i18n.t(line.key, line.vars) : i18n.t("daisu.loading")}
    </motion.p>
  </div>
);

export default SpeechBubble;
