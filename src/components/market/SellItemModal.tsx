import React, { useContext, useEffect, useState } from "react";
import { sellItem } from "../../services/market/MarketSercive";
import { getInventory } from "../../services/users/UserServices";
import UserContext from "../../UserContext";
import Item from "../Item";
import MainButton from "../MainButton";
import { toast } from "react-toastify";
import { AiOutlineClose } from 'react-icons/ai'

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
}

interface Inventory {
  totalPages: number;
  currentPage: number;
  items: InventoryItem[];
}

const SellItemModal: React.FC<Props> = ({ isOpen, onClose, setRefresh }) => {
  const [selectedItem, setSelectedItem] = useState<any>();
  const [price, setPrice] = useState<any>(null);
  const [inventory, setInventory] = useState<Inventory>();
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [loadingButton, setLoadingButton] = useState<boolean>(false);

  const { userData } = useContext(UserContext);

  const handleSubmit = async () => {
    setLoadingButton(true);
    try {
      await sellItem(selectedItem, price);
      setRefresh && setRefresh(true);
      toast.success("Item listed for sale!", {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false,
        progress: undefined,
        theme: "dark",
      });
      onClose();
    } catch (error: any) {
      console.log(error);
      toast.error(error.response.data.message, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false,
        progress: undefined,
        theme: "dark",
      });
    }
    setLoadingButton(false);
  };

  const getInventoryInfo = async (newPage?: boolean) => {
    try {
      !newPage && setLoadingInventory(true);

      const response = await getInventory(
        userData.id,
        newPage ? (inventory && inventory.currentPage + 1) || 1 : 1
      );
      setInventory(response);

      newPage
        ? setInvItems((prev) => [...prev, ...response.items])
        : setInvItems(response.items);
    } catch (error) {
      console.log(error);
    }
    setLoadingInventory(false);
  };

  useEffect(() => {
    if (isOpen) {
      getInventoryInfo(true);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed flex items-center justify-center w-screen h-screen top-[40px] z-50 bg-[#212121]/[.46]">
      <div className="bg-[#17132B] p-8 rounded w-[800px] h-[680px]">
        <div className="flex"><h2 className="text-lg font-semibold mb-2">Sell an Item</h2>
          <div className="ml-auto">
            <AiOutlineClose className="text-white text-2xl cursor-pointer"
              onClick={onClose}
            />

          </div>

        </div>
        <div className="flex justify-between">
          <div className="mb-4 w-1/2">
            <label
              className="block text-gray-400 text-sm font-bold mb-2"
              htmlFor="price"
            >
              Set Price
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-400 leading-tight focus:outline-none focus:shadow-outline"
              id="price"
              type="number"
              min={0}
              placeholder="Price in CP"
              value={price}
              onKeyDown={(event) => {
                if (!/[0-9]/.test(event.key) && event.key !== "Backspace") {
                  event.preventDefault();
                }
              }}
              onChange={
                (e) => setPrice(e.target.value)
              }
            />
          </div>
          {selectedItem && (
            <div className="flex  items-center">
              <span className="text-white text-lg font-semibold mr-2">
                {selectedItem.name}
              </span>
              <img src={selectedItem.image} alt="" className=" h-20" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center overflow-auto max-h-[450px]">
          {loadingInventory ? (
            <div>Loading...</div>
          ) : (
            invItems.map((item, index) => (
              <div
                className="w-1/4 p-2 cursor-pointer"
                key={item._id + index}
                onClick={() => setSelectedItem(item)}
              >
                <Item item={item} />
              </div>
            ))
          )}

          {inventory && inventory.currentPage < inventory.totalPages && (
            <div className="w-60 self-center">
              {" "}
              <MainButton
                onClick={() => getInventoryInfo(true)}
                text="Load More"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4 mt-4">
          {" "}
          <button
            className=" bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md"
            onClick={onClose}
          >
            Close
          </button>{" "}
          <div className="w-44">
            <MainButton
              text="Sell Item"
              onClick={handleSubmit}
              loading={loadingButton}
              disabled={!selectedItem || !price || loadingButton}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellItemModal;
