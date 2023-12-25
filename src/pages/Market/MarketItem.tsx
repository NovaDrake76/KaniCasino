import React, { useContext, useState } from "react";
import MainButton from "../../components/MainButton";
import UserContext from "../../UserContext";
import { Link } from "react-router-dom";
import { IMarketItem } from "../../components/Types";

interface Props {
  item: IMarketItem;
  click: () => void;
  remove: () => void;
}

const MarketItem: React.FC<Props> = ({ item, click, remove }) => {
  const { isLogged, userData } = useContext(UserContext);
  const [loading, setLoading] = useState<boolean>(true);

  const handleImageLoad = () => {
    setLoading(false);
  };

  const isFromLoggedUser = userData?.id === item?.sellerId?._id

  return (
    <div className="border  border-[#161448] rounded-lg p-4 bg-gradient-to-tr from-[#1D1730] to-[#141333] transition-all duration-500 ease-in-out w-[226px] h-[334px]">
      <div className="flex items-center gap-2 relative">
        <span className="text-lg font-semibold text-white truncate">
          {item.item.name}
        </span>
        <Link to={`/profile/${item.sellerId._id}`} >
          <span className="text-xs text-white underline truncate">({item.sellerId.username})</span>
        </Link>
      </div>
      {loading && (
        <div className="w-full h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#606BC7]"></div>
        </div>
      )}
      <img
        src={item.itemImage}
        alt={item.itemName}
        className={`mb-2 w-full h-48 object-cover rounded ${loading ? "hidden" : ""
          }`}
        onLoad={handleImageLoad}
      />
      <p className="text-blue-500 text-center py-1 text-ellipsis truncate">{
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "DOL",
          minimumFractionDigits: 0,
        })
          .format(item.price)
          .replace("DOL", "K₽")
      }</p>

      <MainButton text={
        isFromLoggedUser ? "Remove" : "Buy"
      } onClick={
        isFromLoggedUser ? remove : click
      } disabled={!isLogged} />
    </div>
  );
};

export default MarketItem;