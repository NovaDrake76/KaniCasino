import { motion } from "framer-motion";
import { FaGift } from "react-icons/fa";
import Monetary from "../Monetary";
import DaisuArt from "./DaisuArt";
import type { DaisuViewProps } from "./Daisu.types";
import i18n from "../../i18n";

const DaisuBubbleView: React.FC<DaisuViewProps> = ({ openPopup, inJar, fill, face, attention, bubbleGift }) => (
  <motion.button
    type="button"
    onClick={openPopup}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    aria-label={i18n.t("daisu.open")}
    className="fixed bottom-4 right-4 z-sticky flex items-center gap-2 border-none bg-surface py-1 pl-1 pr-3 text-left shadow-lg hover:border-none hover:bg-surface-hover"
  >
    <span className="relative flex h-12 w-12 items-end justify-center overflow-hidden">
      <DaisuArt bust fill={fill} face={face} className="h-12 w-12 object-contain object-top" />
      {attention && (
        <span className="absolute right-0 top-0 flex h-2.5 w-2.5">
          <span className="absolute inset-0 animate-ping bg-accent-gold opacity-70" />
          <span className="relative h-2.5 w-2.5 bg-accent-gold" />
        </span>
      )}
    </span>
    {bubbleGift ? (
      <span className="flex items-center gap-1.5 text-sm font-bold text-accent-gold">
        <FaGift /> {i18n.t("daisu.bubbleGift")}
      </span>
    ) : (
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-accent-gold">
          <Monetary value={inJar} />
        </span>
        <span className="mt-1 h-1 w-16 bg-surface-nav">
          <span className="daisu-fill block h-full bg-accent-gold" style={{ width: `${Math.round(fill * 100)}%` }} />
        </span>
      </span>
    )}
  </motion.button>
);

export default DaisuBubbleView;
