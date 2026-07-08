import { TieBreakerViewProps } from "./TieBreaker.types";

const TieBreakerView: React.FC<TieBreakerViewProps> = ({
  windowRef,
  strip,
  tx,
  durationMs,
  cellWidth,
  fallbackAvatar,
}) => (
  <div
    ref={windowRef}
    className="relative w-full max-w-[640px] h-28 overflow-hidden rounded-xl bg-[#151225] border border-gray-700"
  >
    <div
      className="flex items-center h-full"
      style={{
        transform: `translateX(${tx}px)`,
        transition: `transform ${durationMs}ms cubic-bezier(0.1, 0, 0.2, 1)`,
      }}
    >
      {strip.map((p, i) => (
        <div
          key={i}
          className="flex-shrink-0 flex flex-col items-center gap-1"
          style={{ width: cellWidth }}
        >
          <img
            src={p.profilePicture || fallbackAvatar}
            alt={p.username}
            className="w-14 h-14 rounded-full object-cover border-2 border-[#281D3F]"
          />
          <span className="text-[10px] truncate max-w-full px-1">{p.username}</span>
        </div>
      ))}
    </div>
    <div className="absolute left-0 inset-y-0 w-16 bg-gradient-to-r from-[#151225] to-transparent pointer-events-none z-10" />
    <div className="absolute right-0 inset-y-0 w-16 bg-gradient-to-l from-[#151225] to-transparent pointer-events-none z-10" />
    <img
      src="/images/arrowSelector.svg"
      alt=""
      className="absolute left-1/2 top-0 z-20 pointer-events-none"
      style={{ width: 40, transform: "translateX(-50%) rotate(180deg)" }}
    />
    <img
      src="/images/arrowSelector.svg"
      alt=""
      className="absolute left-1/2 bottom-0 z-20 pointer-events-none"
      style={{ width: 40, transform: "translateX(-50%)" }}
    />
  </div>
);

export default TieBreakerView;
