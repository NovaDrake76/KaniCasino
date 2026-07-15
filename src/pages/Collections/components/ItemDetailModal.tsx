import { useNavigate } from "react-router-dom";
import { GiOpenChest } from "react-icons/gi";
import { MdOutlineSell, MdStorefront } from "react-icons/md";
import Modal from "../../../components/Modal";
import MainButton from "../../../components/MainButton";
import Monetary from "../../../components/Monetary";
import ItemCard from "./ItemCard";
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

  const locked = item.owned === 0;
  const canSell = isOwner && item.owned > 0 && item.sellValue > 0 && item.uniqueIds.length > 0;

  return (
    <Modal open={open} setOpen={setOpen} width="420px">
      <div className="flex flex-col items-center gap-4">
        <ItemCard item={item} />

        <div className="w-full flex items-center justify-between px-1 text-sm">
          <span className={locked ? "text-ink-faint" : "text-ink-soft"}>
            {locked ? "Not yet collected" : `You own ×${item.owned}`}
          </span>
          <span className="text-ink-muted">
            Sell value <Monetary value={item.sellValue} /> each
          </span>
        </div>

        <div className="flex flex-col gap-2 w-full">
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
