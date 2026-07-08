import { useContext, useState } from "react";
import Rarities from "./Rarities";
import { BsPinAngleFill } from "react-icons/bs";
import { fixItem, sellItems } from "../services/users/UserServices";
import { RotatingLines } from "react-loader-spinner";
import { toast } from "react-toastify";
import UserContext from "../UserContext";
import Monetary from "./Monetary";


interface itemProps {
  item: {
    _id: string;
    name: string;
    image: string;
    rarity: string;
    uniqueId?: string;
    baseValue?: number;
    sellValue?: number;
  };
  fixable?: boolean;
  sellable?: boolean;
  setRefresh?: React.Dispatch<React.SetStateAction<boolean>>;
  size?: "small" | "large";
}

const Item: React.FC<itemProps> = ({ item, fixable, sellable, setRefresh, size = "large" }) => {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [selling, setSelling] = useState<boolean>(false);
  const { userData, toogleUserData } = useContext(UserContext);

  const fixPlayerItem = async (itemId: string) => {
    try {
      await fixItem(itemId);
      setRefresh && setRefresh((prev) => !prev);
    } catch (error) {
      console.log(error);
    }
  };

  const sellPlayerItem = async () => {
    if (!item.uniqueId || selling) return;
    setSelling(true);
    try {
      const res = await sellItems([item.uniqueId]);
      if (userData) {
        toogleUserData({ ...userData, walletBalance: res.walletBalance });
      }
      toast.success(res.message, { theme: "dark" });
      setRefresh && setRefresh((prev) => !prev);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not sell item", { theme: "dark" });
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
        className={`flex flex-col w-full items-center justify-center bg-[#212031] rounded-t-lg relative border-b-4 border-[color:var(--rc)] ${canSell ? "group-hover:border-[#212031]" : ""}`}
        style={{ "--rc": color } as React.CSSProperties}
      >
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
          >
            <BsPinAngleFill className="text-2xl text-blue-500 hover:text-blue-300 transition-all cursor-pointer" />
          </div>
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
          className="absolute top-full inset-x-0 z-30 flex justify-center bg-[#212031] border-b-4 px-2 shadow-xl
          max-h-0 overflow-hidden opacity-0 pointer-events-none
          group-hover:max-h-20 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:pb-2 group-hover:pt-1
          transition-all duration-200"
          style={{ borderColor: color }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); sellPlayerItem(); }}
            disabled={selling}
            className="w-full rounded px-3 py-1.5 text-xs md:text-sm font-semibold bg-[#19172D] hover:bg-green-700 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {selling ? "Selling..." : <span className="flex items-center justify-center gap-1">Sell <Monetary value={item.sellValue ?? 0} /></span>}
          </button>
        </div>
      )}
    </div>
  );
};

export default Item;
