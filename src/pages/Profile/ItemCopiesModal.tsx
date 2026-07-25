import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BsShieldFillCheck } from "react-icons/bs";
import { toast } from "react-toastify";
import Modal from "../../components/Modal";
import Monetary from "../../components/Monetary";
import Pagination from "../../components/Pagination";
import Rarities from "../../components/Rarities";
import { getItemCopies, sellItems } from "../../services/users/UserServices";

interface Copy {
  uniqueId: string;
  createdAt: string;
}

interface Props {
  userId: string;
  item: { _id: string; name: string; image: string; rarity: string; quantity?: number; sellValue?: number };
  isOwner: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSold: () => void;
}

const ItemCopiesModal: React.FC<Props> = ({ userId, item, isOwner, open, setOpen, onSold }) => {
  const [copies, setCopies] = useState<Copy[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(item.quantity ?? 0);
  const [loading, setLoading] = useState(true);
  const [sellingId, setSellingId] = useState<string | null>(null);

  const color = Rarities.find((r) => r.id.toString() === item.rarity)?.color || "white";

  const load = async (p: number) => {
    setLoading(true);
    try {
      const res = await getItemCopies(userId, item._id, p);
      setCopies(res.copies || []);
      setTotalPages(res.totalPages || 1);
      setTotal(res.total ?? 0);
    } catch {
      setCopies([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) load(page);
  }, [open, page, item._id]);

  const sellOne = async (uniqueId: string) => {
    setSellingId(uniqueId);
    try {
      const res = await sellItems([uniqueId]);
      toast.success(res.message, { theme: "dark" });
      onSold();
      // the page can empty out from under us when the last copy on it goes
      const nextPage = copies.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      await load(nextPage);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not sell item", { theme: "dark" });
    }
    setSellingId(null);
  };

  return (
    <Modal open={open} setOpen={setOpen as any} width="560px">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-24 h-24 shrink-0 rounded-lg bg-surface-nav flex items-center justify-center"
            style={{ boxShadow: `0 0 0 1px ${color}` }}
          >
            <img src={item.image} alt={item.name} className="max-h-[85%] max-w-[85%] object-contain" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-lg font-bold">{item.name}</span>
            <span className="text-sm text-ink-muted">
              {total} {total === 1 ? "copy" : "copies"} owned
            </span>
            {!!item.sellValue && (
              <span className="text-sm text-ink-soft">
                <Monetary value={item.sellValue} /> each
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-line pt-3">
          {loading ? (
            <span className="text-sm text-ink-muted py-4 text-center">Loading...</span>
          ) : copies.length === 0 ? (
            <span className="text-sm text-ink-muted py-4 text-center">No copies left.</span>
          ) : (
            copies.map((c) => (
              <div
                key={c.uniqueId}
                className="flex items-center justify-between gap-2 bg-surface-nav rounded px-3 py-2"
              >
                <span className="text-xs text-ink-muted truncate">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/provably-fair?item=${c.uniqueId}`}
                    title="Verify this drop (provably fair)"
                    className="text-green-500 hover:text-green-300 transition-colors"
                  >
                    <BsShieldFillCheck className="text-lg" />
                  </Link>
                  {isOwner && (
                    <button
                      onClick={() => sellOne(c.uniqueId)}
                      disabled={sellingId === c.uniqueId}
                      className="rounded px-2 py-1 text-xs font-semibold bg-surface-raised hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {sellingId === c.uniqueId ? "Selling..." : "Sell"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center">
            <Pagination totalPages={totalPages} currentPage={page} setPage={setPage} />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ItemCopiesModal;
