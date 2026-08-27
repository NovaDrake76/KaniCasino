import { useContext, useEffect, useState } from "react";
import { MdOutlineNavigateBefore, MdOutlineNavigateNext } from "react-icons/md";
import { AiOutlineClose, AiOutlineSearch } from "react-icons/ai";
import Skeleton from "react-loading-skeleton";
import Item from "../../components/Item";
import UserContext from "../../UserContext";
import { getInventory } from "../../services/users/UserServices";
import Rarities from "../../components/Rarities";
import { sourceRarities, ALL_RARITIES } from "./upgradeRules";
import i18n from "../../i18n";

interface Inventory {
    selectedItems: any;
    setSelectedItems: React.Dispatch<React.SetStateAction<any>>;
    selectedCase: any;
    setSelectedCase: React.Dispatch<React.SetStateAction<any>>;
    toggleReload: boolean;
    selectedTarget: any;
    setSelectedTarget: React.Dispatch<React.SetStateAction<any>>;
}

const sortOptions = () => [
    { value: "newer", label: i18n.t("upgrade.newest") },
    { value: "older", label: i18n.t("upgrade.oldest") },
    { value: "mostRare", label: i18n.t("upgrade.rarityHighToLow") },
    { value: "mostCommon", label: i18n.t("upgrade.rarityLowToHigh") },
];

const UserItems: React.FC<Inventory> = ({ selectedItems, setSelectedItems, selectedCase, setSelectedCase, toggleReload, selectedTarget, setSelectedTarget }) => {
    const [inventory, setInventory] = useState<any>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [pageLimit, setPageLimit] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [search, setSearch] = useState<string>("");
    const [inventoryFilters, setInventoryFilters] = useState({
        name: "",
        rarity: "",
        sortBy: "newer", // default: newest items first
        order: "asc",
        caseId: "",
    });
    const { userData } = useContext(UserContext);

    // the target and the pile between them decide what is still legal to stake, so anything
    // the server would refuse never reaches the grid
    const allowedRarities = sourceRarities(selectedItems, selectedTarget);
    const restricted = allowedRarities.length < ALL_RARITIES.length;
    const allowedKey = allowedRarities.join(",");

    // any filter/sort change goes back to the first page
    const updateFilters = (patch: Partial<typeof inventoryFilters>) => {
        setInventoryFilters((prev) => ({ ...prev, ...patch }));
        setCurrentPage(1);
    };

    // debounce the search box into the name filter
    useEffect(() => {
        const timeout = setTimeout(() => {
            setInventoryFilters((prev) => (prev.name === search ? prev : { ...prev, name: search }));
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(timeout);
    }, [search]);

    const getInventoryInfo = async () => {
        setLoading(true);
        if (userData) {
            try {
                const newFilters = { ...inventoryFilters };
                if (selectedCase) {
                    newFilters.caseId = selectedCase;
                }
                // the dropdown narrows the allowed set, it never widens it
                newFilters.rarity =
                    newFilters.rarity && allowedRarities.includes(Number(newFilters.rarity))
                        ? newFilters.rarity
                        : restricted
                            ? allowedKey
                            : "";
                const inventory = await getInventory(userData.id, currentPage, {
                    ...newFilters,
                    grouped: true,
                    withIds: true,
                });
                setInventory(inventory.items);
                setPageLimit(inventory.totalPages);
            } catch (error) {
                console.log(error);
            }
        }
        setLoading(false);
    };

    // a stacked card adds one copy per click and gives the copies back one per click,
    // so the same card can be tapped up to the number owned
    const handleItemClick = (item: any) => {
        const ids: string[] = item.uniqueIds?.length ? item.uniqueIds : [item.uniqueId];
        const taken = new Set(
            selectedItems.map((s: { identifier: string }) => s.identifier)
        );
        const next = ids.find((id) => !taken.has(id));

        if (!next) {
            // every copy on this card is already in, so a further click gives them all back
            setSelectedItems(
                selectedItems.filter((s: { identifier: string }) => !ids.includes(s.identifier))
            );
            return;
        }

        setSelectedItems([...selectedItems, { item, identifier: next }]);
        setSelectedCase(item.case);
    };

    const selectedCountFor = (item: any) => {
        const ids: string[] = item.uniqueIds?.length ? item.uniqueIds : [item.uniqueId];
        return selectedItems.filter((s: { identifier: string }) => ids.includes(s.identifier)).length;
    };

    const clearCase = () => {
        setSelectedCase(null);
        setSelectedItems([]);
        setSelectedTarget(null);
        updateFilters({ caseId: "" });
    };

    useEffect(() => {
        setCurrentPage(1);
        setInventoryFilters((prev) =>
            prev.rarity && !allowedRarities.includes(Number(prev.rarity)) ? { ...prev, rarity: "" } : prev
        );
    }, [allowedKey]);

    useEffect(() => {
        getInventoryInfo();
    }, [currentPage, inventoryFilters, userData, selectedCase, toggleReload, allowedKey]);

    const selectClass = "bg-[#19172D] border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#606bc7]";

    return (
        <div className="flex flex-col md:w-1/2 gap-2">
            <div className="flex flex-col gap-3 bg-[#1C1A33] rounded px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="font-semibold">{i18n.t("profile.inventory")}</span>
                        {restricted && (
                            <span className="text-xs text-gray-400">{i18n.t("upgrade.onlyWhatFits")}</span>
                        )}
                    </div>
                    {selectedCase && (
                        <div
                            className="flex items-center gap-1 cursor-pointer border-b border-gray-500 text-gray-400 hover:text-white"
                            onClick={clearCase}
                        >
                            <AiOutlineClose />
                            <span>{i18n.t("upgrade.clearCase")}</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-[#19172D] border border-gray-700 rounded px-2 flex-1 min-w-[160px]">
                        <AiOutlineSearch className="text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={i18n.t("upgrade.searchItems")}
                            className="bg-transparent py-1 w-full text-sm focus:outline-none"
                        />
                        {search && (
                            <AiOutlineClose className="text-gray-400 cursor-pointer" onClick={() => setSearch("")} />
                        )}
                    </div>
                    <select
                        value={inventoryFilters.sortBy}
                        onChange={(e) => updateFilters({ sortBy: e.target.value })}
                        className={selectClass}
                    >
                        {sortOptions().map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <select
                        value={inventoryFilters.rarity}
                        onChange={(e) => updateFilters({ rarity: e.target.value })}
                        className={selectClass}
                    >
                        <option value="">{i18n.t("market.allRarities")}</option>
                        {Rarities.filter((r) => allowedRarities.includes(r.id)).map((r) => (
                            <option key={r.id} value={String(r.id)}>{r.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="flex h-[500px] border-2 border-[#1C1A33] flex-wrap gap-2 p-4 overflow-y-auto justify-around">
                {loading ? (
                    { array: Array(12).fill(0) }.array.map((_, i) => (
                        <Skeleton width={176} height={216} highlightColor="#161427" baseColor="#1c1a31" key={i} />
                    ))
                ) : inventory.length > 0 ? (
                    inventory.map((item: any, index: number) => {
                        if (item.case) {
                            const picked = selectedCountFor(item);
                            return (
                                <div
                                    key={index}
                                    onClick={() => handleItemClick(item)}
                                    className={`relative cursor-pointer border-2 h-min ${picked ? " border-[#606bc7]" : "border-transparent"}`}
                                >
                                    <Item item={item} />
                                    {picked > 0 && (
                                        <span className="absolute top-1 right-1 z-20 min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full text-xs font-bold bg-[#606bc7] text-white">
                                            {picked}
                                        </span>
                                    )}
                                </div>
                            );
                        }
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center gap-4">
                        <span className="font-semibold">{i18n.t("upgrade.noItemsFound")}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-4 text-white">
                <MdOutlineNavigateBefore
                    style={{
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        color: currentPage === 1 ? "gray" : "white",
                    }}
                    onClick={() => {
                        if (currentPage !== 1) setCurrentPage((prev) => prev - 1);
                    }}
                />
                <span>Page: {currentPage}{pageLimit > 0 ? ` / ${pageLimit}` : ""}</span>
                <MdOutlineNavigateNext
                    style={{
                        cursor: currentPage === pageLimit ? "not-allowed" : "pointer",
                        color: currentPage === pageLimit ? "gray" : "white",
                    }}
                    onClick={() => {
                        if (currentPage !== pageLimit) setCurrentPage((prev) => prev + 1);
                    }}
                />
            </div>
        </div>
    );
};

export default UserItems;
