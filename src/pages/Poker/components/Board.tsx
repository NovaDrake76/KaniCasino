import { AnimatePresence, motion } from "framer-motion";
import Monetary from "../../../components/Monetary";
import PlayingCard from "../../../components/game/PlayingCard";
import { pokerToDisplay } from "../../../components/game/cards";
import { rarityColor } from "../../../utils/rarity";
import { PokerPot, PooledItem } from "../../../services/poker/PokerService";
import i18n from "../../../i18n";

interface BoardProps {
  board: number[];
  pots: PokerPot[];
  liveTotal: number;
  atRisk: PooledItem[];
  handNumber: number;
  status: string;
}

// the table-level announcement. once a legendary is one call away from changing hands the
// whole room should know, including the people only watching.
const OnTheLine = ({ items }: { items: PooledItem[] }) => {
  const top = items.slice().sort((a, b) => Number(b.rarity) - Number(a.rarity) || b.value - a.value)[0];
  if (!top) return null;
  const color = rarityColor(top.rarity);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="notched-sm p-[2px]"
      style={{ backgroundColor: color }}
    >
      <div className="notched-sm flex items-center gap-2 bg-[#19172d] px-3 py-1.5">
        <img src={top.image} alt="" className="h-7 w-7 object-contain" />
        <span className="text-xs font-bold text-white">
          {items.length > 1
            ? i18n.t("poker.onTheLineMany", { name: top.name, count: items.length - 1 })
            : i18n.t("poker.onTheLineOne", { name: top.name })}
        </span>
      </div>
    </motion.div>
  );
};

const Board = ({ board, pots, liveTotal, atRisk, handNumber, status }: BoardProps) => (
  <div className="flex flex-col items-center gap-3">
    <AnimatePresence>{atRisk.length > 0 && <OnTheLine items={atRisk} />}</AnimatePresence>

    <div className="flex min-h-[92px] items-center gap-1.5 sm:gap-2">
      <AnimatePresence mode="popLayout">
        {board.map((card, i) => (
          <motion.div
            key={`${handNumber}-${i}-${card}`}
            layout
            initial={{ opacity: 0, y: -20, rotateY: 180 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ duration: 0.35, delay: i < 3 ? i * 0.12 : 0 }}
            className="[&>*]:!w-[52px] sm:[&>*]:!w-[66px]"
          >
            <PlayingCard card={pokerToDisplay(card)} instant />
          </motion.div>
        ))}
      </AnimatePresence>
      {!board.length && status !== "idle" && (
        <span className="text-xs uppercase tracking-widest text-[#625F7E]">
          {i18n.t("poker.preflop")}
        </span>
      )}
    </div>

    {(liveTotal > 0 || pots.length > 0) && (
      <motion.div layout className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#625F7E]">
          {i18n.t("poker.pot")}
        </span>
        <span className="notched-sm bg-[#19172d] px-4 py-1.5 text-lg font-extrabold text-[#FFCC00]">
          <Monetary value={liveTotal} />
        </span>
        {pots.length > 1 && (
          <div className="flex gap-1">
            {pots.slice(1).map((pot, i) => (
              <span key={i} className="notched-xs bg-[#212031] px-2 py-0.5 text-[10px] text-[#84819A]">
                {i18n.t("poker.sidePot")} <Monetary value={pot.amount} />
              </span>
            ))}
          </div>
        )}
      </motion.div>
    )}
  </div>
);

export default Board;
