import Skeleton from "react-loading-skeleton";
import { Link } from "react-router-dom";
import Monetary from "../../../components/Monetary";
import Pagination from "../../../components/Pagination";
import { rarityColor, rarityName } from "../../../utils/rarity";
import { MyListing } from "../../../services/market/MarketService";
import { MyListingsViewProps } from "./MyListings.types";
import i18n from "../../../i18n";

const GRID = "grid grid-cols-[repeat(auto-fill,200px)] justify-center gap-4";

const ListingCard = ({ listing, removing, onRemove }: { listing: MyListing; removing: boolean; onRemove: (uniqueId: string) => void }) => {
  const color = rarityColor(listing.rarity);
  return (
    <div className="w-[200px] rounded-xl border border-line bg-surface overflow-hidden">
      <Link
        to={`/marketplace/item/${listing.item}`}
        className="group relative h-40 flex items-center justify-center bg-surface-nav border-b-2"
        style={{ borderColor: color }}
      >
        <img
          src={listing.itemImage}
          alt={listing.itemName}
          className="max-h-32 max-w-[80%] object-contain transition-all group-hover:scale-105"
          style={{ filter: `drop-shadow(0 0 14px ${color}55)` }}
        />
      </Link>
      <div className="p-3 flex flex-col gap-1">
        <span className="text-sm font-semibold text-ink truncate">{listing.itemName}</span>
        <span className="text-[10px]" style={{ color }}>
          {rarityName(listing.rarity)}
        </span>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-ink-muted">{i18n.t("market.yourPrice")}</span>
            <span className="text-sm font-bold text-accent truncate">
              <Monetary value={listing.price} />
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(listing.uniqueId)}
            disabled={removing}
            className="shrink-0 text-xs text-ink-faint hover:text-red-400 disabled:opacity-50"
          >
            {i18n.t("market.removeListing")}
          </button>
        </div>
      </div>
    </div>
  );
};

const MyListingsView: React.FC<MyListingsViewProps> = ({ loading, listings, total, totalPages, page, setPage, removing, remove }) => (
  <div className="flex flex-col gap-4">
    {loading ? (
      <div className={GRID}>
        {Array(6)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} height={260} width={200} borderRadius={12} />
          ))}
      </div>
    ) : listings.length === 0 ? (
      <div className="rounded-xl border border-line bg-surface p-12 text-center text-ink-muted">{i18n.t("market.nothingListedYet")}</div>
    ) : (
      <>
        <span className="text-xs text-ink-muted">{i18n.t("market.listedCount", { count: total })}</span>
        <div className={GRID}>
          {listings.map((l) => (
            <ListingCard key={l.uniqueId} listing={l} removing={removing === l.uniqueId} onRemove={remove} />
          ))}
        </div>
      </>
    )}

    {totalPages > 1 && (
      <div className="flex justify-center">
        <Pagination totalPages={totalPages} currentPage={page} setPage={setPage} />
      </div>
    )}
  </div>
);

export default MyListingsView;
