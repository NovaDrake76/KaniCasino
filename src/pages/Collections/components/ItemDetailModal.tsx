import { useNavigate } from "react-router-dom";
import { GiOpenChest } from "react-icons/gi";
import { MdOutlineSell, MdStorefront } from "react-icons/md";
import Modal from "../../../components/Modal";
import MainButton from "../../../components/MainButton";
import Monetary from "../../../components/Monetary";
import Rarities from "../../../components/Rarities";
import { rarityColor } from "../../../utils/rarity";
import { AlbumItem } from "../../../services/collections/CollectionService";

interface Props {
  item: AlbumItem | null;
  caseId: string;
  isOwner: boolean;
  selling: boolean;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSellOne: (uniqueId: string) => void;
}

const ItemDetailModal: React.FC<Props> = ({
  item,
  caseId,
  isOwner,
  selling,
  open,
  setOpen,
  onSellOne,
}) => {
  const navigate = useNavigate();

  if (!item) return null;

  const color = rarityColor(item.rarity);
  const locked = item.owned === 0;
  const rarityName = Rarities.find((r) => r.id.toString() === item.rarity)?.name || "";
  const canSell = isOwner && item.owned > 0 && item.sellValue > 0 && item.uniqueIds.length > 0;

  return (
    <Modal open={open} setOpen={setOpen} width="420px">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-full h-40 flex items-center justify-center rounded-lg bg-surface border-b-4"
          style={{ borderColor: locked ? "#2A2840" : color }}
        >
          <img
            src={item.image}
            alt={item.name}
            className={`max-h-32 max-w-[80%] object-contain ${locked ? "grayscale opacity-25" : ""}`}
            style={locked ? undefined : { filter: `drop-shadow(0 0 14px ${color}66)` }}
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-lg font-semibold text-ink">{item.name}</h3>
          <span className="text-xs font-medium" style={{ color }}>
            {rarityName}
          </span>
          <span className="text-sm text-ink-muted">
            Sell value <Monetary value={item.sellValue} /> each
          </span>
          <span className={`mt-1 text-sm ${locked ? "text-ink-faint" : "text-ink-soft"}`}>
            {locked ? "Not yet collected" : `You own ×${item.owned}`}
          </span>
        </div>

        <div className="flex flex-col gap-2 w-full mt-2">
          <MainButton
            text="Go to case"
            onClick={() => navigate(`/case/${caseId}`)}
            icon={<GiOpenChest />}
            type="button"
          />
          <MainButton
            text="Search on market"
            onClick={() => navigate(`/marketplace/item/${item._id}`)}
            icon={<MdStorefront />}
            type="info"
          />
          {canSell && (
            <MainButton
              text={<span className="flex items-center gap-1">Sell one for <Monetary value={item.sellValue} /></span>}
              onClick={() => onSellOne(item.uniqueIds[0])}
              icon={<MdOutlineSell />}
              type="success"
              loading={selling}
              disabled={selling}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ItemDetailModal;
