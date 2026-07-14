import React, { useContext, useEffect, useRef, useState } from "react";
import { sellItem } from "../../services/market/MarketService";
import { getInventory } from "../../services/users/UserServices";
import UserContext from "../../UserContext";
import Item from "../../components/Item";
import MainButton from "../../components/MainButton";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import Pagination from "../../components/Pagination";
import Filters from "../../components/InventoryFilters";
import Modal from "../../components/Modal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  setRefresh?: (value: boolean) => void;
}

interface InventoryItem {
  _id: string;
  name: string;
  image: string;
  rarity: string;
  uniqueId: string
}

interface Inventory {
  totalPages: number;
  currentPage: number;
  items: InventoryItem[];
}

const SellItemModal: React.FC<Props> = ({ isOpen, onClose, setRefresh }) => {
  const [selectedItem, setSelectedItem] = useState<any>();
  const [price, setPrice] = useState<number | undefined>();
  const [inventory, setInventory] = useState<Inventory>();
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [loadingButton, setLoadingButton] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [filters, setFilters] = useState({
    name: '',
    rarity: '',
    sortBy: '',
    order: 'asc'
  });
  const delayDebounceFn = useRef<NodeJS.Timeout | null>(null);

  const { userData } = useContext(UserContext);

  const CloseModal = () => {
    setSelectedItem(null);
    setPrice(0);
    setInvItems([]);
    setPage(1);
    onClose();
  }

  const handleSubmit = async () => {
    setLoadingButton(true);

    if (!price || price < 1 || price > 1000000) {
      setLoadingButton(false);
      return toast.error("Price must be between 1 and 1.000.000", {});
    }

    try {
      await sellItem(selectedItem.uniqueId, price);
      setRefresh && setRefresh(true);
      toast.success("Item listed for sale!", {});
      CloseModal();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not list the item");
    }
    setLoadingButton(false);
  };

  const getInventoryInfo = async (newPage?: number) => {
    try {
      const response = await getInventory(
        userData.id,
        page,
        filters
      );
      setInventory(response);
      newPage
        ? setInvItems((prev) => [...prev, ...response.items])
        : setInvItems(response.items);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleEnterPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Cancel the debounce
      clearTimeout(delayDebounceFn.current as NodeJS.Timeout);
      // Fetch the inventory immediately
      getInventoryInfo();
    }
  };

  useEffect(() => {
    if (invItems?.length > 0) {
      delayDebounceFn.current = setTimeout(() => {
        getInventoryInfo();
      }, 1000);
      return () => {
        if (delayDebounceFn.current) {
          clearTimeout(delayDebounceFn.current);
        }
      };
    }
  }, [filters]);

  useEffect(() => {
    if (isOpen) {
      setInvItems([]);
      getInventoryInfo(page);
    }
  }, [isOpen, page]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal open={isOpen} setOpen={onClose} width="min(960px, 95vw)">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Sell an item</h2>

        <Filters filters={filters} setFilters={setFilters} onKeyPress={handleEnterPress} />

        <div className="max-h-[42vh] overflow-y-auto overflow-x-hidden -mx-1 px-1">
          {loadingInventory ? (
            <div className="flex flex-wrap justify-center gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} width={128} height={150} baseColor="#1c1a31" highlightColor="#161427" />
              ))}
            </div>
          ) : invItems.length === 0 ? (
            <div className="text-center text-[#84819a] py-12">No items to sell.</div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {invItems.map((item, index) => {
                const isSelected = selectedItem && selectedItem.uniqueId === item.uniqueId;
                return (
                  <div
                    key={item._id + index}
                    onClick={() => setSelectedItem(item)}
                    className={`rounded-lg cursor-pointer transition-all p-1 border-2 ${
                      isSelected ? "border-indigo-500 bg-indigo-500/10" : "border-transparent hover:bg-[#212031]"
                    }`}
                  >
                    <Item item={item} size="small" />
                  </div>
                );
              })}
            </div>
          )}
          {inventory && inventory.totalPages > 1 && (
            <div className="w-full flex justify-center mt-3">
              <Pagination
                totalPages={inventory.totalPages}
                currentPage={inventory.currentPage}
                setPage={setPage}
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col sm:flex-row sm:items-center gap-3 border-t border-gray-700 pt-4 bg-[#19172D]">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {selectedItem ? (
              <>
                <img src={selectedItem.image} alt={selectedItem.name} className="w-12 h-12 object-contain shrink-0" />
                <span className="font-semibold truncate">{selectedItem.name}</span>
              </>
            ) : (
              <span className="text-[#84819a] text-sm">Pick an item above to sell it.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <span className="absolute inset-y-0 left-3 flex items-center text-[#84819a] text-sm pointer-events-none">
                K₽
              </span>
              <input
                type="number"
                min={0}
                max={1000000}
                placeholder="Price"
                value={price ?? ""}
                onKeyDown={(event) => {
                  if (!/[0-9]/.test(event.key) && !["Backspace", "Tab", "ArrowLeft", "ArrowRight", "Delete"].includes(event.key)) {
                    event.preventDefault();
                  }
                }}
                onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                className="w-full sm:w-36 bg-[#19172D] border border-gray-700 focus:border-indigo-500 outline-none rounded pl-9 pr-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={CloseModal}
              className="px-4 py-2 rounded bg-[#281D3F] hover:bg-red-700 text-sm font-semibold"
            >
              Close
            </button>
            <div className="w-32 shrink-0">
              <MainButton
                text="Sell item"
                onClick={handleSubmit}
                loading={loadingButton}
                disabled={!selectedItem || !price || loadingButton}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SellItemModal;
