import React, { useContext, useEffect, useState } from "react";
import { sellItem } from "../../services/market/MarketSercive";
import { getInventory } from "../../services/users/UserServices";
import UserContext from "../../UserContext";
import Item from "../../components/Item";
import MainButton from "../../components/MainButton";
import { toast } from "react-toastify";
import { AiOutlineClose } from 'react-icons/ai'
import Skeleton from "react-loading-skeleton";
import Pagination from "../../components/Pagination";

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
  const [price, setPrice] = useState<number>(0);
  const [inventory, setInventory] = useState<Inventory>();
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [loadingButton, setLoadingButton] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

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

    if (price < 0 || price > 1000000) {
      setLoadingButton(false);
      return toast.error("Price must be between 0 and 1.000.000", {});
    }

    try {
      await sellItem(selectedItem._id, price);
      setRefresh && setRefresh(true);
      toast.success("Item listed for sale!", {
      });
      CloseModal();
    } catch (error: any) {
      console.log(error);
      toast.error(error.response.data.message);
    }
    setLoadingButton(false);
  };

  const getInventoryInfo = async (page = 1) => {
    try {
      setLoadingInventory(true);

      const response = await getInventory(userData.id, page);
      if (page === 1) {
        setInvItems(response.items);
      } else {
        setInvItems((prev) => [...prev, ...response.items]);
      }
      setInventory(response);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingInventory(false);
    }
  };


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
    <div className="fixed flex items-center justify-center w-screen h-screen top-0 z-50 bg-black/40">
      <div className="bg-[#17132B] p-4 sm:p-6 lg:p-8 rounded w-screen md:max-w-screen-md mx-2 sm:mx-4 h-[90vh]">
        <div className="flex"><h2 className="text-lg font-semibold mb-2">Sell an Item</h2>
          <div className="ml-auto">
            <AiOutlineClose className="text-white text-2xl cursor-pointer"
              onClick={CloseModal}
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
              max={100000}
              placeholder="Price in KP"
              value={price}
              onKeyDown={(event) => {
                if (!/[0-9]/.test(event.key) && event.key !== "Backspace") {
                  event.preventDefault();
                }
              }}
              onChange={
                (e) => setPrice(parseInt(e.target.value) || 0)
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

        <div className="flex flex-col justify-center max-h-[450px] overflow-x-hidden gap-4">
          <div className="flex flex-wrap justify-center gap-4  overflow-auto mt-4 ">
            {loadingInventory ? (
              [1, 2, 3, 4, 5, 6].map((_, i) => (
                <Skeleton height={200} width={200} key={i} />
              ))

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
          </div>
          {inventory && (
            <div className="w-full flex justify-center">
              <Pagination totalPages={inventory.totalPages} currentPage={inventory.currentPage} setPage={setPage} />

            </div>)
          }
        </div>


        <div className="flex items-center justify-end gap-4 mt-4 ">

          <button
            className=" bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md"
            onClick={CloseModal}
          >
            Close
          </button>
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
