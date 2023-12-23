import { BsSearch } from 'react-icons/bs';

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
                placeholder="Search"
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
            <option value="">All Rarities</option>
            <option value="1">Common</option>
            <option value="2">Rare</option>
            <option value="3">Epic</option>
            <option value="4">Ultra Rare</option>
            <option value="5">Unique</option>

            {/* Add other rarities as needed */}
        </select>

        {/* Sort by */}
        <select
            value={filters.sortBy}
            onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
            className="px-3 py-2 border rounded-md focus:outline-none focus:border-blue-500"
        >
            <option value="">Sort By</option>
            <option value="recent">Most Recent</option>
            <option value="older">Oldest First</option>
            <option value="mostRare">Most Rare First</option>
            <option value="mostCommon">Most Common First</option>
        </select>


        {/* Order Ascending or Descending */}
        {/* <select
            value={filters.order}
            onChange={(e) => setFilters((prev) => ({ ...prev, order: e.target.value }))}
            className="px-3 py-2 border rounded-md focus:outline-none focus:border-blue-500"
        >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
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
