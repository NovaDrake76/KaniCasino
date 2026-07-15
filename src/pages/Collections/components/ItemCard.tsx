import { BsLockFill } from "react-icons/bs";
import { rarityColor, rarityName, rarityAbbr } from "../../../utils/rarity";
import { AlbumItem } from "../../../services/collections/CollectionService";

interface Props {
  item: AlbumItem;
}

// double-lined parchment plate, the frame element every label on the card sits
// in; tint washes the inner face with a translucent color
const Plate: React.FC<{
  dim?: boolean;
  grow?: boolean;
  tint?: string;
  children: React.ReactNode;
}> = ({ dim, grow, tint, children }) => (
  <div
    className={`rounded-md border border-black/50 p-[3px] ${grow ? "flex-1 min-w-0" : "shrink-0"} ${
      dim ? "bg-[#8f8a7c]" : "bg-[#EDE4CC]"
    }`}
  >
    <div
      className="h-full rounded-[4px] border border-black/25 px-2 py-0.5 flex items-center justify-center min-w-0"
      style={tint ? { backgroundImage: `linear-gradient(${tint}, ${tint})` } : undefined}
    >
      {children}
    </div>
  </div>
);

// light bands keep dark ink, dark bands flip to light, so the footer stays
// readable on every rarity color
const isLightHex = (hex: string): boolean => {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150;
};

// a full collection card: numbered plates, framed art and a description panel
// textured in the item's rarity color
const ItemCard: React.FC<Props> = ({ item }) => {
  const locked = item.owned === 0;
  const color = locked ? "#3A365A" : rarityColor(item.rarity);
  const cardNo = item.slotNumber ? String(item.slotNumber).padStart(2, "0") : "EX";

  const artBackground = locked
    ? "linear-gradient(160deg, #262338, #15131f)"
    : [
        "repeating-linear-gradient(105deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 7px)",
        `radial-gradient(120% 90% at 30% 25%, ${color}55, transparent 60%)`,
        "linear-gradient(160deg, #223357, #101a33 55%, #1b2545)",
      ].join(", ");

  const panelTexture = [
    "linear-gradient(115deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 35%)",
    "radial-gradient(rgba(255,255,255,0.20) 1px, transparent 1.4px)",
    "radial-gradient(rgba(0,0,0,0.30) 1px, transparent 1.4px)",
    "linear-gradient(rgba(10,6,20,0.35), rgba(10,6,20,0.5))",
  ].join(", ");

  return (
    <div className="w-full rounded-2xl bg-[#0E0C1B] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
      <div className="relative rounded-xl border border-[#57506E]/60 p-2 flex flex-col gap-2">
        <span className="absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-[#CDC3A5]/70 rounded-tl" />
        <span className="absolute top-1 right-1 w-2.5 h-2.5 border-t border-r border-[#CDC3A5]/70 rounded-tr" />
        <span className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b border-l border-[#CDC3A5]/70 rounded-bl" />
        <span className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r border-[#CDC3A5]/70 rounded-br" />

        <div className="flex items-stretch gap-1.5">
          <Plate dim={locked}>
            <span className="font-serif font-bold text-base leading-none text-[#241F35]">
              {cardNo}
            </span>
          </Plate>
          <Plate dim={locked} grow>
            <span className="font-semibold text-sm text-[#241F35] truncate">{item.name}</span>
          </Plate>
          <Plate dim={locked} tint={locked ? undefined : `${color}59`}>
            <span className="font-serif font-bold text-base leading-none text-[#241F35]">
              {rarityAbbr(item.rarity)}
            </span>
          </Plate>
        </div>

        <div className={`rounded-md p-1 ${locked ? "bg-[#8f8a7c]" : "bg-[#EDE4CC]"}`}>
          <div
            className="relative h-44 rounded-[4px] border border-black/40 flex items-center justify-center overflow-hidden"
            style={{ background: artBackground }}
          >
            <img
              src={item.image}
              alt={item.name}
              className={`max-h-36 max-w-[75%] object-contain ${
                locked ? "grayscale opacity-25" : ""
              }`}
              style={locked ? undefined : { filter: `drop-shadow(0 0 16px ${color}77)` }}
            />
            {locked && (
              <span className="absolute inset-0 flex items-center justify-center text-[#8f8a7c]">
                <BsLockFill className="text-3xl" />
              </span>
            )}
          </div>
        </div>

        <div
          className="rounded-md border border-black/40 p-2.5 flex flex-col gap-1.5"
          style={{
            backgroundColor: color,
            backgroundImage: panelTexture,
            backgroundSize: "auto, 9px 13px, 13px 17px, auto",
          }}
        >
          <div
            className={`rounded-[4px] px-3 py-2.5 min-h-[84px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] ${
              locked ? "bg-[#d6d2c4]" : "bg-[#F5EEDA]"
            }`}
          >
            {item.description ? (
              <p className="text-sm leading-relaxed text-[#2A2440] break-words">
                {item.description}
              </p>
            ) : (
              <p className="text-sm italic text-[#8A8064]">No description yet.</p>
            )}
          </div>
          <div
            className={`flex items-center justify-between px-0.5 text-[9px] font-medium uppercase tracking-widest ${
              isLightHex(color) ? "text-black/60" : "text-white/70"
            }`}
          >
            <span>©Kani Collection</span>
            <span>{locked ? "Undiscovered" : rarityName(item.rarity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
