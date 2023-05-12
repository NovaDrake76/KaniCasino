import React, { useContext } from "react";
import MainButton from "../MainButton";
import UserContext from "../../UserContext";

interface Props {
  item: {
    _id: string;
    sellerId: any;
    item: {
      _id: string;
      name: string;
      image: string;
    };
    price: number;
    itemName: string;
    itemImage: string;
    __v: number;
  };
  click: () => void;
}

const MarketItem: React.FC<Props> = ({ item, click }) => {
  const { isLogged } = useContext(UserContext);

  return (
    <div className="border  border-[#161448] rounded-lg p-4 bg-gradient-to-tr from-[#1D1730] to-[#141333] transition-all duration-500 ease-in-out w-[226px]">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-white ">
          {item.item.name}
        </span>
        <span className="text-xs  text-white ">({item.sellerId.username})</span>
      </div>
      <img
        src={item.itemImage}
        alt={item.itemName}
        className="mb-2 w-full h-48 object-cover rounded"
      />
      <p className="text-blue-500 text-center py-1">{item.price} C₽</p>

      <MainButton text="Buy" onClick={click} disabled={!isLogged} />
    </div>
  );
};

export default MarketItem;
