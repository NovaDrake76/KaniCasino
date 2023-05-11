import React from "react";
import { buyItem } from "../../services/market/MarketSercive";
import MainButton from "../MainButton";

interface MarketItem {
  _id: string;
  sellerId: string;
  item: {
    _id: string;
    name: string;
    image: string;
  };
  price: number;
  itemName: string;
  itemImage: string;
  __v: number;
}

interface Props {
  item: MarketItem;
  isOpen: boolean;
  onClose: () => void;
  setRefresh?: (value: boolean) => void;
}

const ConfirmPurchaseModal: React.FC<Props> = ({
  item,
  isOpen,
  onClose,
  setRefresh,
}) => {
  const [loading, setLoading] = React.useState<boolean>(false);
  const handleConfirm = async () => {
    setLoading(true);
    try {
      await buyItem(item._id as unknown as number);
      setRefresh && setRefresh(true);
      onClose();
    } catch (error) {
      console.log(error);
    }
    setLoading(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed flex items-center justify-center w-screen z-50">
      <div className="bg-[#17132B] p-8 rounded w-[600px] h-[300px]">
        <h2 className="text-lg font-semibold mb-2">Confirm Purchase</h2>
        <div className="flex justify-between items-center">
          <p className="text-white text-lg">
            Are you sure you want to buy the {item.item.name} for {item.price}{" "}
            CP?
          </p>
          <img src={item.item.image} alt="" className="h-20" />
        </div>

        <div className="flex items-center justify-end gap-4 mt-4">
          <button
            className=" bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md"
            onClick={onClose}
          >
            Cancel
          </button>
          <div className="w-44">
            <MainButton
              text="Confirm"
              onClick={handleConfirm}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmPurchaseModal;
