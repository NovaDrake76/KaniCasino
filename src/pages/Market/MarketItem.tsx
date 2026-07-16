import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Monetary from "../../components/Monetary";
import { rarityColor, rarityName } from "../../utils/rarity";

interface Props {
  item: {
    image: string;
    name: string;
    rarity: number;
    _id: string;
    uniqueId: string;
    cheapestPrice: number | null;
    totalListings: number;
    sellValue?: number;
  };
}

// one item on the market: rarity-framed art, what it starts at, and how deep the
// book is. an item with no listings is still shown so it can be bid on.
const MarketItem: React.FC<Props> = ({ item }) => {
  const [loaded, setLoaded] = useState<boolean>(false);
  const navigate = useNavigate();
  const color = rarityColor(item.rarity);
  const listed = item.totalListings > 0;

  return (
    <button
      type="button"
      onClick={() => navigate(`/marketplace/item/${item._id}`)}
      className="group w-[200px] rounded-xl border border-line bg-surface hover:border-line-strong hover:-translate-y-1 transition-all overflow-hidden text-left"
    >
      <div
        className="relative h-40 flex items-center justify-center bg-surface-nav border-b-2"
        style={{ borderColor: color }}
      >
        {!loaded && <div className="absolute inset-0 animate-pulse bg-surface-nav" />}
        <img
          src={item.image}
          alt={item.name}
          onLoad={() => setLoaded(true)}
          className={`max-h-32 max-w-[80%] object-contain transition-all group-hover:scale-105 ${
            loaded ? "" : "opacity-0"
          }`}
          style={{ filter: `drop-shadow(0 0 14px ${color}55)` }}
        />
        {listed && (
          <span className="absolute top-2 right-2 rounded-full bg-surface/90 border border-line px-2 py-0.5 text-[10px] text-ink-muted">
            {item.totalListings}
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1">
        <span className="text-sm font-semibold text-ink truncate">{item.name}</span>
        <span className="text-[10px]" style={{ color }}>
          {rarityName(item.rarity)}
        </span>
        <div className="mt-1 flex items-end justify-between gap-2">
          {listed ? (
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-ink-muted">Starting at</span>
              <span className="text-sm font-bold text-accent truncate">
                <Monetary value={item.cheapestPrice || 0} />
              </span>
            </div>
          ) : (
            <span className="text-xs text-ink-faint">No listings</span>
          )}
          <span className="text-[10px] text-ink-faint shrink-0 group-hover:text-ink-muted">
            {listed ? "View" : "Place bid"}
          </span>
        </div>
      </div>
    </button>
  );
};

export default MarketItem;
