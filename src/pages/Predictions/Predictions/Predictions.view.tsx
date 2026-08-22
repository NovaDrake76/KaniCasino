import Skeleton from "react-loading-skeleton";
import Title from "../../../components/Title";
import Pagination from "../../../components/Pagination";
import MarketCard from "../MarketCard";
import { PredictionsViewProps, StatusFilter } from "./Predictions.types";
import i18n from "../../../i18n";

const STATUSES: StatusFilter[] = ["open", "closed", "resolved", "all"];

const PredictionsView: React.FC<PredictionsViewProps> = ({
  markets,
  loading,
  categories,
  category,
  setCategory,
  status,
  setStatus,
  search,
  setSearch,
  page,
  totalPages,
  setPage,
  openMarket,
}) => (
  <div className="w-full flex flex-col items-center py-8 gap-6 px-4">
    <Title title={i18n.t("predictions.title")} />

    <p className="text-ink-muted text-sm max-w-[700px] text-center -mt-4">
      {i18n.t("predictions.subtitle")}
    </p>

    <div className="w-full max-w-[1100px] flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={i18n.t("predictions.searchMarkets")}
          className="bg-surface-nav border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-accent flex-1"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`text-xs px-3 py-2 rounded transition-colors ${
                status === value ? "bg-accent text-ink" : "bg-surface-nav text-ink-muted hover:text-ink"
              }`}
            >
              {i18n.t(`predictions.filter.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {categories.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {["All", ...categories].map((value) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                category === value ? "bg-surface-hover text-ink" : "bg-surface-nav text-ink-muted hover:text-ink"
              }`}
            >
              {value === "All" ? i18n.t("predictions.allCategories") : value}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={190} borderRadius={8} />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg py-16 text-center text-ink-muted text-sm">
          {i18n.t("predictions.noMarkets")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market) => (
            <MarketCard key={market._id} market={market} onClick={() => openMarket(market.slug)} />
          ))}
        </div>
      )}

      {totalPages > 1 && <Pagination totalPages={totalPages} currentPage={page} setPage={setPage} />}
    </div>
  </div>
);

export default PredictionsView;
