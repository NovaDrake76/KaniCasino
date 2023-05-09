import React, { useEffect, useState } from "react";
import Rarities from "../Rarities";

interface CaseOpenedNotificationProps {
  username: string;
  item: {
    name: string;
    image: string;
    rarity: number;
  };
}

const CaseOpenedNotification: React.FC<CaseOpenedNotificationProps> = ({
  item,
}) => {
  const [transition, setTransition] = useState<boolean>(false);

  useEffect(() => {
    setTransition(true);
  }, [item]);

  const getColor = (e: number) => {
    return Rarities.find((rarity) => rarity.id == e)?.color;
  };

  return (
    <div
      className={`flex flex-col min-w-[160px] h-28 items-center transition-opacity duration-10 border bg-[#141225] ${
        transition ? "opacity-100" : "opacity-0 -translate-y-2"
      }`}
      style={{
        borderColor: `${getColor(item.rarity)} transparent ${getColor(
          item.rarity
        )}  #1e1b38 `,
      }}
    >
      <div className="flex flex-col  items-center space-x-2 relative">
        <img
          src={item.image}
          alt={item.name}
          className="w-20 h-20  z-10 object-cover rounded p-2"
        />
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: "1px",
            boxShadow: `0px 0px 40px 25px ${
              Rarities.find((rarity) => rarity.id == item.rarity)?.color
            }`,
          }}
        />
        <div className="text-white z-10">{item.name}</div>
      </div>
    </div>
  );
};

export default CaseOpenedNotification;
