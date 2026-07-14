import { FiAlertTriangle } from "react-icons/fi";
import Modal from "../../../components/Modal";
import MainButton from "../../../components/MainButton";
import Monetary from "../../../components/Monetary";
import { rarityColor } from "../../../utils/rarity";
import { QuicksellPreview } from "../../../services/collections/CollectionService";

interface Props {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  preview: QuicksellPreview | null;
  committing: boolean;
  onConfirm: () => void;
}

const QuicksellModal: React.FC<Props> = ({ open, setOpen, preview, committing, onConfirm }) => {
  const lines = preview?.lines || [];
  const totalItems = preview?.totalItems || 0;
  const totalValue = preview?.totalValue || 0;

  return (
    <Modal open={open} setOpen={setOpen} width="520px">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FiAlertTriangle className="text-2xl text-accent-amber" />
          <h3 className="text-lg font-semibold text-ink">Sell duplicates?</h3>
        </div>
        <p className="text-sm text-ink-muted">
          Keeps <span className="text-ink font-medium">1 of each</span> item and sells the rest.{" "}
          <span className="text-red-400">This cannot be undone.</span>
        </p>

        {totalItems === 0 ? (
          <p className="text-ink-muted py-6 text-center">No duplicates to sell.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {lines.map((l) => {
              const color = rarityColor(l.rarity);
              return (
                <div key={l._id} className="flex items-center gap-3 bg-surface-nav rounded-lg p-2">
                  <div
                    className="relative w-12 h-12 shrink-0 flex items-center justify-center rounded bg-surface border-b-2"
                    style={{ borderColor: color }}
                  >
                    <img src={l.image} alt={l.name} className="max-h-10 max-w-10 object-contain" />
                    <span
                      className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full text-[11px] font-bold bg-surface-raised text-ink"
                      style={{ boxShadow: `0 0 0 1px ${color}` }}
                    >
                      ×{l.sellCount}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm text-ink-soft truncate">{l.name}</span>
                    <span className="text-xs text-ink-muted">
                      <Monetary value={l.unitSellValue} /> each
                    </span>
                  </div>
                  <span className="text-sm font-medium text-ink shrink-0">
                    <Monetary value={l.lineValue} />
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-line">
          <span className="text-sm text-ink-muted">
            Selling <span className="text-ink font-medium">{totalItems}</span> item
            {totalItems !== 1 ? "s" : ""}
          </span>
          <span className="text-lg font-semibold text-accent-gold">
            <Monetary value={totalValue} />
          </span>
        </div>

        <div className="flex items-center gap-3">
          <MainButton text="Cancel" onClick={() => setOpen(false)} type="dark" />
          <MainButton
            text={`Sell ${totalItems} duplicate${totalItems !== 1 ? "s" : ""}`}
            onClick={onConfirm}
            type="danger"
            loading={committing}
            disabled={committing || totalItems === 0}
          />
        </div>
      </div>
    </Modal>
  );
};

export default QuicksellModal;
