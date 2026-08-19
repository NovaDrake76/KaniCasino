import { BsSearch } from 'react-icons/bs';
import i18n from "../i18n";

interface Filters {
    filters: {
        name: string;
        rarity: string;
        sortBy: string;
        order: string;
    };
    setFilters: React.Dispatch<React.SetStateAction<{
        name: string;
        rarity: string;
        sortBy: string;
        order: string;
    }>>;
    onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;

}

const InventoryFilters: React.FC<Filters> = ({ filters, setFilters, onKeyPress }) => (
    <div className="flex flex-wrap gap-4 mb-4 w-full justify-end">
        {/* Filter by name */}
        <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <BsSearch className="h-4 w-4 text-gray-500" aria-hidden="true" />
            </span>
            <input
                type="text"
                placeholder={i18n.t("common.search")}
                value={filters.name}
                onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                onKeyPress={onKeyPress}
                className="pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:border-blue-500"
            />
        </div>

        {/* Filter by rarity */}
        <select
            value={filters.rarity}
            onChange={(e) => setFilters((prev) => ({ ...prev, rarity: e.target.value }))}
            className="px-3 py-2 border rounded-md focus:outline-none focus:border-blue-500"
        >
            <option value="">{i18n.t("common.allRarities")}</option>
            <option value="1">{i18n.t("common.common")}</option>
            <option value="2">{i18n.t("common.rare")}</option>
            <option value="3">{i18n.t("common.epic")}</option>
            <option value="4">{i18n.t("common.ultraRare")}</option>
            <option value="5">{i18n.t("common.unique")}</option>
        </select>

        {/* Sort by */}
        <select
            value={filters.sortBy}
            onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
            className="px-3 py-2 border rounded-md focus:outline-none focus:border-blue-500"
        >
            <option value="">{i18n.t("common.sortBy")}</option>
            <option value="newer">{i18n.t("common.mostRecent")}</option>
            <option value="older">{i18n.t("common.oldestFirst")}</option>
            <option value="mostRare">{i18n.t("common.mostRareFirst")}</option>
            <option value="mostCommon">{i18n.t("common.mostCommonFirst")}</option>
        </select>


        {/* Order Ascending or Descending */}
        {/* <select
            value={filters.order}
            onChange={(e) => setFilters((prev) => ({ ...prev, order: e.target.value }))}
            className="px-3 py-2 border rounded-md focus:outline-none focus:border-blue-500"
        >
            <option value="asc">{i18n.t("common.ascending")}</option>
            <option value="desc">{i18n.t("common.descending")}</option>
        </select> */}



        {/* Button to clear all filters */}
        <button
            onClick={() => setFilters({ name: '', rarity: '', sortBy: '', order: 'asc' })}
            className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:border-red-700 focus:ring focus:ring-red-200"
        >
            Clear Filters
        </button>
    </div>
)

export default InventoryFilters;
