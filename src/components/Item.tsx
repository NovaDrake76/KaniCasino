import { useState } from "react";
import Rarities from "./Rarities";
import { BsPinAngleFill } from "react-icons/bs";
import { fixItem } from "../services/users/UserServices";

interface itemProps {
  item: {
    name: string;
    image: string;
    rarity: number;
  };
  fixable?: boolean;
  setRefresh?: React.Dispatch<React.SetStateAction<boolean>>;
}

const Item: React.FC<itemProps> = ({ item, fixable, setRefresh }) => {
  const [hovering, setHovering] = useState<boolean>(false);

  const fixPlayerItem = async (name: string, image: string, rarity: string) => {
    try {
      await fixItem(name, image, rarity);
      setRefresh && setRefresh((prev) => !prev);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div
      className="flex flex-col w-44 items-center justify-center bg-[#212031] rounded relative"
      key={item.name + Math.random()}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="w-44 h-44 hover:scale-105 transition-all object-contain "
        />
        <div
          className="w-auto"
          style={{
            boxShadow: `0px 0px 120px 80px ${
              Rarities.find((rarity) => rarity.id == item.rarity)?.color
            }`,
          }}
        />
      </div>
      {fixable && (
        <div
          className={`absolute top-1 right-1 transition-all ${
            hovering ? "opacity-100 " : "opacity-0 -translate-y-2"
          }`}
          onClick={() =>
            fixPlayerItem(item.name, item.image, item.rarity.toString())
          }
        >
          <BsPinAngleFill className="text-2xl text-blue-500 hover:text-blue-300 transition-all cursor-pointer" />
        </div>
      )}
      <p className="text-base py-2">{item.name}</p>
    </div>
  );
};

export default Item;
