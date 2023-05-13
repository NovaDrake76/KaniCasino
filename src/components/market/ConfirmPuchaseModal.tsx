import React, { useContext } from "react";
import { buyItem } from "../../services/market/MarketSercive";
import MainButton from "../MainButton";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";

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
  const { userData, toogleUserData } = useContext(UserContext);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await buyItem(item._id as unknown as number);
      setRefresh && setRefresh(true);
      toogleUserData({
        ...userData,
        walletBalance: userData.walletBalance - item.price,
      });

      toast.success("Purchase successful!", {
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
      console.log(error);
    }
    setLoading(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed flex items-center justify-center w-screen z-50 ">
      <div className="bg-[#17132B] p-8 rounded w-[600px] h-[290px]">
        <h2 className="text-lg font-semibold mb-2">Confirm Purchase</h2>
        <div className="flex justify-between items-center">
          <p className="text-white text-lg">
            Are you sure you want to buy the {item.item.name} for {item.price}{" "}
            CP?
          </p>
          <img src={item.item.image} alt="" className="h-28" />
        </div>

        <div className="flex items-center justify-end gap-4 mt-12">
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
