import { motion } from "framer-motion";
import { cardAria, isRedSuit, rankLabel, suitOf } from "./blackjackCards";

// inline svg suit marks: unicode suit glyphs render as emoji on ios, so never use them
const SuitIcon = ({ suit, className }: { suit: number; className?: string }) => {
  if (suit === 1) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M12 21S4 15.5 4 9.9A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.9C20 15.5 12 21 12 21z" />
      </svg>
    );
  }
  if (suit === 2) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M12 2l7 10-7 10-7-10z" />
      </svg>
    );
  }
  if (suit === 3) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle fill="currentColor" cx="12" cy="7" r="4" />
        <circle fill="currentColor" cx="7" cy="13" r="4" />
        <circle fill="currentColor" cx="17" cy="13" r="4" />
        <path fill="currentColor" d="M10.6 14h2.8l1.1 7h-5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M12 2s8 6.6 8 11.4a4.3 4.3 0 0 1-8 2.1 4.3 4.3 0 0 1-8-2.1C4 8.6 12 2 12 2z" />
      <path fill="currentColor" d="M10.6 14.5h2.8l1.1 6.5h-5z" />
    </svg>
  );
};

interface PlayingCardProps {
  card?: number;
  faceDown?: boolean;
  // entrance delay in seconds, staggering the deal
  delay?: number;
  instant?: boolean;
}

// code-drawn card: flat white face with corner rank + suit, css 3d flip to reveal
const PlayingCard = ({ card, faceDown = false, delay = 0, instant = false }: PlayingCardProps) => {
  const red = card != null && isRedSuit(card);
  const color = red ? "text-red-600" : "text-[#151225]";
  return (
    <motion.div
      className="relative w-14 sm:w-[72px] aspect-[5/7] select-none"
      style={{ perspective: 1000 }}
      initial={instant ? false : { y: -46, x: 30, opacity: 0 }}
      animate={{ y: 0, x: 0, opacity: 1 }}
      transition={{ duration: instant ? 0 : 0.3, delay: instant ? 0 : delay, ease: "easeOut" }}
      aria-label={faceDown || card == null ? "face-down card" : cardAria(card)}
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: faceDown ? 180 : 0 }}
        transition={{ duration: instant ? 0 : 0.5 }}
      >
        <div
          className={`absolute inset-0 rounded-md bg-white shadow-md p-1 sm:p-1.5 ${color}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {card != null && (
            <>
              <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
                <span className="font-bold text-sm sm:text-lg">{rankLabel(card)}</span>
                <SuitIcon suit={suitOf(card)} className="w-3 sm:w-3.5 mt-0.5" />
              </div>
              <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
                <span className="font-bold text-sm sm:text-lg">{rankLabel(card)}</span>
                <SuitIcon suit={suitOf(card)} className="w-3 sm:w-3.5 mt-0.5" />
              </div>
              <SuitIcon
                suit={suitOf(card)}
                className="absolute inset-0 m-auto w-5 sm:w-7 opacity-25"
              />
            </>
          )}
        </div>
        <div
          className="absolute inset-0 rounded-md bg-[#281D3F] border-2 border-[#4F46E5]/60 shadow-md"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(79,70,229,0.25) 0 4px, transparent 4px 9px)",
          }}
        />
      </motion.div>
    </motion.div>
  );
};

export default PlayingCard;
