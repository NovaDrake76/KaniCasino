import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import Rarities from "./Rarities";
import { BsHeartFill, BsShieldFillCheck } from "react-icons/bs";
import { fixItem, sellItems, sellStack } from "../services/users/UserServices";
import { RotatingLines } from "react-loader-spinner";
import { toast } from "react-toastify";
import UserContext from "../UserContext";
import Monetary from "./Monetary";
import i18n from "../i18n";


interface itemProps {
  item: {
    _id: string;
    name: string;
    image: string;
    rarity: string;
    uniqueId?: string;
    baseValue?: number;
    sellValue?: number;
    quantity?: number;
  };
  fixable?: boolean;
  sellable?: boolean;
  setRefresh?: React.Dispatch<React.SetStateAction<boolean>>;
  size?: "small" | "large";
  onClick?: () => void;
}

const Item: React.FC<itemProps> = ({ item, fixable, sellable, setRefresh, size = "large", onClick }) => {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [selling, setSelling] = useState<boolean>(false);
  const { userData, toogleUserData } = useContext(UserContext);
  const quantity = item.quantity ?? 1;

  const fixPlayerItem = async (itemId: string) => {
    try {
      await fixItem(itemId);
      setRefresh && setRefresh((prev) => !prev);
    } catch (error) {
      console.log(error);
    }
  };

  // the card's uniqueId is the newest copy, so a plain sell always sells that one
  const sellPlayerItem = async (all = false) => {
    if (selling) return;
    if (!all && !item.uniqueId) return;
    setSelling(true);
    try {
      const res = all ? await sellStack(item._id) : await sellItems([item.uniqueId as string]);
      if (userData) {
        toogleUserData({ ...userData, walletBalance: res.walletBalance });
      }
      toast.success(res.message, { theme: "dark" });
      setRefresh && setRefresh((prev) => !prev);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || i18n.t("common.couldNotSellItem"), { theme: "dark" });
      setSelling(false);
    }
  };

  const color = Rarities.find((rarity) => rarity.id.toString() == item?.rarity)?.color || "white";
  const ItemsWidthSize = size === "large" ? "w-32 md:w-44" : "w-24 md:w-32";
  const ItemHeightSize = size === "large" ? "h-32 md:h-44" : "h-24 md:h-32";
  // the expanding sell drawer is only for the owner's own items (sell-to-house)
  const canSell = !!sellable && !!item.uniqueId && (item.sellValue ?? 0) > 0;

  return (
    <div className={`relative group ${ItemsWidthSize}`}>
      <div
        className={`flex flex-col w-full items-center justify-center bg-[#212031] rounded-t-lg relative border-b-4 border-[color:var(--rc)] ${canSell ? "group-hover:border-[#212031]" : ""} ${onClick ? "cursor-pointer" : ""}`}
        style={{ "--rc": color } as React.CSSProperties}
        onClick={onClick}
      >
        {quantity > 1 && (
          <span
            className="absolute top-1 left-1 z-20 min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full text-xs font-bold bg-surface-raised text-ink"
            style={{ boxShadow: `0 0 0 1px ${color}` }}
          >
            ×{quantity}
          </span>
        )}
        <div className="overflow-hidden">
          {!loaded && <div className={`flex  ${ItemsWidthSize} ${ItemHeightSize} items-center justify-center`}>
            <RotatingLines
              strokeColor="grey"
              strokeWidth="5"
              animationDuration="0.75"
              width="50px"
              visible={true}
            />
          </div>}
          <img
            src={item?.image}
            alt={item?.name}
            className={`${ItemsWidthSize} ${ItemHeightSize} hover:scale-105 transition-all object-contain ${loaded ? '' : 'hidden'}`}
            onLoad={() => setLoaded(true)}
          />
          <div
            className="w-auto"
            style={{
              boxShadow: `0px 0px 120px 80px ${color}`,
            }}
          />
        </div>
        {fixable && (
          <div
            className="absolute top-1 right-1 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
            onClick={() => fixPlayerItem(item._id)}
            title={i18n.t("fandom.pinHint", { name: item.name })}
          >
            <BsHeartFill className="text-2xl text-pink-500 hover:text-pink-300 transition-all cursor-pointer" />
          </div>
        )}
        {fixable && item.uniqueId && (
          <Link
            to={`/provably-fair?item=${item.uniqueId}`}
            className="absolute top-9 right-1 z-30 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
            title={i18n.t("common.verifyThisDropProvably")}
          >
            <BsShieldFillCheck className="text-2xl text-green-500 hover:text-green-300 transition-all cursor-pointer" />
          </Link>
        )}
        <div className="flex gap-2 items-center -ml-1 max-w-[160px]">
          <div className={`w-1 h-1 md:h-2 md:w-2 aspect-square rounded-full`} style={{
            backgroundColor: color
          }} />
          <p className={`text-xs md:text-base py-2 max-h-[32px] md:max-h-none text-center
          overflow-hidden truncate w-full max-w-[80px] md:max-w-none ${size === "large" ? "md:w-auto" : "md:w-20"}`}>
            {item?.name}
          </p>
        </div>
      </div>
      {canSell && (
        <div
          className="absolute top-full inset-x-0 z-30 flex flex-col gap-1 bg-[#212031] border-b-4 px-2 shadow-xl
          max-h-0 overflow-hidden opacity-0 pointer-events-none
          group-hover:max-h-32 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:pb-2 group-hover:pt-1
          transition-all duration-200"
          style={{ borderColor: color }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); sellPlayerItem(); }}
            disabled={selling}
            className="w-full rounded px-3 py-1.5 text-xs md:text-sm font-semibold bg-[#19172D] hover:bg-green-700 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {selling ? "Selling..." : <span className="flex items-center justify-center gap-1">{i18n.t("common.sell")} <Monetary value={item.sellValue ?? 0} /></span>}
          </button>
          {quantity > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); sellPlayerItem(true); }}
              disabled={selling}
              className="w-full rounded px-3 py-1.5 text-xs md:text-sm font-semibold bg-[#19172D] hover:bg-green-700 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {selling ? "Selling..." : <span className="flex items-center justify-center gap-1">Sell all {quantity} <Monetary value={(item.sellValue ?? 0) * quantity} /></span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Item;
