import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import { IoArrowBack } from "react-icons/io5";
import { MdOutlineSell } from "react-icons/md";
import Monetary from "../../../components/Monetary";
import MainButton from "../../../components/MainButton";
import Pagination from "../../../components/Pagination";
import CompletionBar from "../components/CompletionBar";
import AlbumSlot from "../components/AlbumSlot";
import ItemDetailModal from "../components/ItemDetailModal";
import QuicksellModal from "../components/QuicksellModal";
import { CollectionDetailViewProps } from "./CollectionDetail.types";
import { AlbumFilter } from "./CollectionDetail.services";

const FILTERS: { key: AlbumFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "owned", label: "Owned" },
  { key: "missing", label: "Missing" },
  { key: "duplicates", label: "Duplicates" },
];

const CollectionDetailView: React.FC<CollectionDetailViewProps> = ({
  caseId,
  detail,
  loading,
  error,
  isOwner,
  needsTarget,
  backLink,
  page,
  setPage,
  filter,
  setFilter,
  sortBy,
  setSortBy,
  selectedItem,
  modalOpen,
  setModalOpen,
  selling,
  openItem,
  handleSellOne,
  quicksellOpen,
  setQuicksellOpen,
  quicksellPreview,
  quicksellLoading,
  committing,
  openQuicksell,
  confirmQuicksell,
}) => {
  return (
    <div className="w-screen max-w-[1400px] px-4 md:px-8 flex flex-col gap-6 pb-16">
      <Link to={backLink} className="flex items-center gap-2 text-ink-muted hover:text-ink w-fit">
        <IoArrowBack /> Back to collections
      </Link>

      {needsTarget ? (
        <p className="text-ink-muted">Log in to view collections.</p>
      ) : loading && !detail ? (
        <Skeleton height={140} borderRadius={12} />
      ) : error || !detail ? (
        <p className="text-ink-muted">Could not load this collection.</p>
      ) : (
        <>
          <div className="w-full bg-surface rounded-xl border border-line p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="h-24 w-24 flex items-center justify-center shrink-0">
              <img src={detail.image} alt={detail.title} className="max-h-full object-contain" />
            </div>
            <div className="flex flex-col gap-3 flex-1 w-full">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-ink">{detail.title}</h2>
                {detail.duplicatesValue > 0 && (
                  <span className="text-sm text-ink-muted">
                    Duplicates worth{" "}
                    <span className="text-accent-gold font-medium">
                      <Monetary value={detail.duplicatesValue} />
                    </span>
                  </span>
                )}
              </div>
              <CompletionBar
                owned={detail.slotsOwned}
                total={detail.slotsTotal}
                pct={detail.completionPct}
              />
            </div>
            {isOwner && detail.duplicatesValue > 0 && (
              <div className="w-full md:w-52 shrink-0">
                <MainButton
                  text="Quicksell duplicates"
                  onClick={openQuicksell}
                  icon={<MdOutlineSell />}
                  type="warning"
                  loading={quicksellLoading}
                  disabled={quicksellLoading}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-line">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                    filter === f.key
                      ? "bg-surface-raised text-ink"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "mostRare" | "mostCommon")}
              className="bg-surface-nav border border-line rounded-md px-3 py-2 text-sm text-ink-soft"
            >
              <option value="mostRare">Rarest first</option>
              <option value="mostCommon">Most common first</option>
            </select>
          </div>

          {detail.items.length === 0 ? (
            <p className="text-ink-muted py-8 text-center">No items match this filter.</p>
          ) : (
            <div className="flex flex-wrap gap-4 md:gap-6 justify-center">
              {detail.items.map((item) => (
                <AlbumSlot key={item._id} item={item} onClick={() => openItem(item)} />
              ))}
            </div>
          )}

          {detail.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination totalPages={detail.totalPages} currentPage={page} setPage={setPage} />
            </div>
          )}

          {detail.extras.length > 0 && (
            <div className="flex flex-col gap-4 mt-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-ink">No longer in this case</h3>
                <span className="text-sm text-ink-muted">
                  Items you collected that have since been removed from the case.
                </span>
              </div>
              <div className="flex flex-wrap gap-4 md:gap-6 justify-center">
                {detail.extras.map((item) => (
                  <AlbumSlot key={item._id} item={item} onClick={() => openItem(item)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ItemDetailModal
        item={selectedItem}
        caseId={caseId}
        isOwner={isOwner}
        selling={selling}
        open={modalOpen}
        setOpen={setModalOpen}
        onSellOne={handleSellOne}
      />

      <QuicksellModal
        open={quicksellOpen}
        setOpen={setQuicksellOpen}
        preview={quicksellPreview}
        committing={committing}
        onConfirm={confirmQuicksell}
      />
    </div>
  );
};

export default CollectionDetailView;
