import { BsLockFill } from "react-icons/bs";
import { rarityColor } from "../../../utils/rarity";
import { AlbumItem } from "../../../services/collections/CollectionService";

interface Props {
  item: AlbumItem;
  onClick: () => void;
}

// one album slot: a full-color card for an owned item (with a count badge for
// duplicates), or a greyed, locked placeholder that still shows the item name.
const AlbumSlot: React.FC<Props> = ({ item, onClick }) => {
  const color = rarityColor(item.rarity);
  const locked = item.owned === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group w-28 md:w-40 flex flex-col items-center rounded-lg bg-surface border-b-4 pt-2 transition-all hover:-translate-y-1"
      style={{ borderColor: locked ? "#2A2840" : color }}
    >
      {item.owned > 1 && (
        <span
          className="absolute top-1 right-1 z-10 min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full text-xs font-bold bg-surface-raised text-ink"
          style={{ boxShadow: `0 0 0 1px ${color}` }}
        >
          ×{item.owned}
        </span>
      )}

      <div className="relative w-full h-24 md:h-32 flex items-center justify-center overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className={`max-h-full max-w-full object-contain transition-all ${
            locked ? "grayscale opacity-20" : "group-hover:scale-105"
          }`}
          style={locked ? undefined : { filter: `drop-shadow(0 0 12px ${color}66)` }}
        />
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center text-ink-faint">
            <BsLockFill className="text-xl md:text-2xl" />
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-2 w-full">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: locked ? "#3A365A" : color }}
        />
        <span className={`text-xs truncate ${locked ? "text-ink-faint" : "text-ink-soft"}`}>
          {item.name}
        </span>
      </div>
    </button>
  );
};

export default AlbumSlot;
