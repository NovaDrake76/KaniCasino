import { BsLockFill } from "react-icons/bs";
import { rarityColor, rarityAbbr } from "../../../utils/rarity";
import { AlbumItem } from "../../../services/collections/CollectionService";

interface Props {
  item: AlbumItem;
  onClick: () => void;
}

// one album slot, styled as a miniature of the full collection card: numbered
// plate, framed art and a name plate over the rarity-textured band. missing
// items render as a greyed, locked placeholder that still shows the name.
const AlbumSlot: React.FC<Props> = ({ item, onClick }) => {
  const locked = item.owned === 0;
  const color = locked ? "#3A365A" : rarityColor(item.rarity);
  const plateBg = locked ? "bg-[#8f8a7c]" : "bg-[#EDE4CC]";
  const cardNo = item.slotNumber ? String(item.slotNumber).padStart(2, "0") : "EX";

  const artBackground = locked
    ? "linear-gradient(160deg, #262338, #15131f)"
    : `radial-gradient(120% 90% at 30% 25%, ${color}50, transparent 60%), linear-gradient(160deg, #223357, #101a33 55%, #1b2545)`;

  const bandTexture = [
    "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1.3px)",
    "linear-gradient(rgba(10,6,20,0.35), rgba(10,6,20,0.5))",
  ].join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group w-32 md:w-44 flex flex-col gap-1 rounded-xl bg-[#0E0C1B] p-1.5 transition-all hover:-translate-y-1"
      style={{ boxShadow: `0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px ${locked ? "#2A2840" : `${color}55`}` }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`${plateBg} rounded px-1.5 py-0.5 font-serif font-bold text-[10px] leading-none text-[#241F35] border border-black/40`}
        >
          {cardNo}
        </span>
        <span
          className={`${plateBg} rounded px-1.5 py-0.5 font-serif font-bold text-[10px] leading-none text-[#241F35] border border-black/40`}
          style={locked ? undefined : { backgroundImage: `linear-gradient(${color}59, ${color}59)` }}
        >
          {rarityAbbr(item.rarity)}
        </span>
      </div>

      <div className={`rounded-md p-[2px] ${plateBg}`}>
        <div
          className="relative h-20 md:h-28 rounded-[3px] border border-black/40 flex items-center justify-center overflow-hidden"
          style={{ background: artBackground }}
        >
          {item.owned > 1 && (
            <span
              className="absolute top-1 right-1 z-10 min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full text-xs font-bold bg-surface-raised text-ink"
              style={{ boxShadow: `0 0 0 1px ${color}` }}
            >
              ×{item.owned}
            </span>
          )}
          <img
            src={item.image}
            alt={item.name}
            className={`max-h-[85%] max-w-[80%] object-contain transition-all ${
              locked ? "grayscale opacity-25" : "group-hover:scale-105"
            }`}
            style={locked ? undefined : { filter: `drop-shadow(0 0 10px ${color}66)` }}
          />
          {locked && (
            <span className="absolute inset-0 flex items-center justify-center text-[#8f8a7c]">
              <BsLockFill className="text-xl md:text-2xl" />
            </span>
          )}
        </div>
      </div>

      <div
        className="rounded-md border border-black/40 p-1"
        style={{
          backgroundColor: color,
          backgroundImage: bandTexture,
          backgroundSize: "8px 12px, auto",
        }}
      >
        <div className={`${plateBg} rounded-[3px] px-1.5 py-0.5 border border-black/25`}>
          <span className="block text-[11px] font-semibold truncate text-[#241F35]">
            {item.name}
          </span>
        </div>
      </div>
    </button>
  );
};

export default AlbumSlot;
