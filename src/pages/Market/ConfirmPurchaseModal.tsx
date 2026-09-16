import React, { useState } from "react";
import { buyItem } from "../../services/market/MarketService";
import MainButton from "../../components/MainButton";
import { toast } from "react-toastify";
import { IMarketItem } from "../../components/Types";
import i18n from "../../i18n";

interface Props {
  item: IMarketItem;
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
  const [loading, setLoading] = useState<boolean>(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await buyItem(item._id as string);
      setRefresh && setRefresh(true);
      // the balance comes back over the socket, so it stays in step with the server
      toast.success(i18n.t("market.purchaseSuccessful"));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || i18n.t("market.couldNotCompleteThe"));
    } finally {
      setLoading(false);
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 px-4">
      <div className="bg-[#17132B] p-5 md:p-8 rounded w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-2">{i18n.t("market.confirmPurchase")}</h2>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white md:text-lg break-words min-w-0">
            Are you sure you want to buy the {item.item.name} for {item.price} KP?
          </p>
          <img src={item.item.image} alt="" className="h-24 md:h-28 shrink-0" />
        </div>

        <div className="flex items-center justify-end gap-4 mt-8 md:mt-12">
          <button
            className=" bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md"
            onClick={onClose}
          >
            {i18n.t("collections.cancel")}
          </button>
          <div className="flex-1 sm:flex-none sm:w-44">
            <MainButton
              text={i18n.t("market.confirm")}
              onClick={handleConfirm}
              loading={loading}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmPurchaseModal;
