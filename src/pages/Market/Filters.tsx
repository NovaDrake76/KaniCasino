import React, { useState, useEffect } from "react";
import Rarities from "../../components/Rarities";
import { FiSearch } from "react-icons/fi";

export interface MarketFilters {
  name: string;
  rarity: string;
  sortBy: string;
  order: string;
  listedOnly: boolean;
}

interface FiltersProps {
  filters: MarketFilters;
  setFilters: React.Dispatch<React.SetStateAction<MarketFilters>>;
}

const SORTS = [
  { value: "recent", label: "Recently listed" },
  { value: "price", label: "Price" },
  { value: "rarity", label: "Rarity" },
  { value: "listings", label: "Most listings" },
  { value: "name", label: "Name" },
];

const select =
  "bg-surface-nav border border-line rounded-md px-3 py-2 text-sm text-ink-soft focus:border-accent outline-none";

// always-visible filter bar. sorting actually works now: the backend used to accept
// sortBy/order and silently ignore them.
const Filters: React.FC<FiltersProps> = ({ filters, setFilters }) => {
  const [name, setName] = useState(filters.name);

  // debounce only the text field; selects apply immediately
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => (prev.name === name ? prev : { ...prev, name }));
    }, 500);
    return () => clearTimeout(handler);
  }, [name, setFilters]);

  const set = (patch: Partial<MarketFilters>) => setFilters((prev) => ({ ...prev, ...patch }));

  return (
    <div className="w-full max-w-[1312px] flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px]">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          placeholder="Search items"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-surface-nav border border-line rounded-md pl-9 pr-3 py-2 text-sm text-ink focus:border-accent outline-none"
        />
      </div>

      <select value={filters.rarity} onChange={(e) => set({ rarity: e.target.value })} className={select}>
        <option value="">All rarities</option>
        {Rarities.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      <select value={filters.sortBy} onChange={(e) => set({ sortBy: e.target.value })} className={select}>
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select value={filters.order} onChange={(e) => set({ order: e.target.value })} className={select}>
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>

      <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer select-none px-2">
        <input
          type="checkbox"
          checked={filters.listedOnly}
          onChange={(e) => set({ listedOnly: e.target.checked })}
          className="accent-indigo-600"
        />
        On sale only
      </label>
    </div>
  );
};

export default Filters;
