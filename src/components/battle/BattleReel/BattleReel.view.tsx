import { BattleReelViewProps } from "./BattleReel.types";

const BattleReelView: React.FC<BattleReelViewProps> = ({
  strip,
  ty,
  durationMs,
  cellHeight,
  windowHeight,
}) => (
  <div
    className="relative w-full overflow-hidden rounded-lg bg-[#151225]"
    style={{ height: windowHeight }}
  >
    <div
      className="flex flex-col items-center"
      style={{
        transform: `translateY(${ty}px)`,
        transition: `transform ${durationMs}ms cubic-bezier(0.1, 0, 0.2, 1)`,
      }}
    >
      {strip.map((c, i) => (
        <div
          key={i}
          className="flex-shrink-0 flex items-center justify-center w-full"
          style={{ height: cellHeight }}
        >
          <img
            src={c.image}
            alt={c.name}
            className="h-[128px] w-[128px] object-contain"
            style={{ borderBottom: `3px solid ${c.color}` }}
          />
        </div>
      ))}
    </div>
    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-[#151225] to-transparent z-10 pointer-events-none" />
    <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#151225] to-transparent z-10 pointer-events-none" />
    <img
      src="/images/arrowSelector.svg"
      alt=""
      className="absolute left-0 top-1/2 z-20 pointer-events-none"
      style={{ width: 46, transform: "translateY(-50%) rotate(90deg)" }}
    />
    <img
      src="/images/arrowSelector.svg"
      alt=""
      className="absolute right-0 top-1/2 z-20 pointer-events-none"
      style={{ width: 46, transform: "translateY(-50%) rotate(270deg)" }}
    />
  </div>
);

export default BattleReelView;
