import React, { useEffect, useState } from "react";
import Rarities from "../Rarities";
import { Link } from "react-router-dom";
import { BasicItem } from "../Types";

interface CaseOpenedNotificationProps {
  user: {
    name: string;
    profilePicture: string;
    id: string;
  };
  item: BasicItem;
  caseImage: string;
}


const CaseOpenedNotification: React.FC<CaseOpenedNotificationProps> = ({
  user, item, caseImage
}) => {
  const [transition, setTransition] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);


  useEffect(() => {
    setTransition(true);
  }, []);

  const getColor = (e: number) => {
    return Rarities.find((rarity) => rarity.id == e)?.color;
  };


  return (
    <div
      className={`flex flex-col min-w-[160px] h-28 items-center transition-all duration-500 border bg-[#141225] 
      ${transition ? "opacity-100" : "opacity-0 "}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        borderColor: `${getColor(item.rarity)} transparent ${getColor(
          item.rarity
        )}  #1e1b38 `,
      }}
    >
      <div style={{
        width: "100%",
        transition: "all 0.3s ease",
        transform: `${isHovering ? "rotateY(180deg)" : "rotateY(0deg)"}`,
      }}>
        <div className={`flex flex-col transition-all w-full items-center space-x-2 relative ${isHovering ? "opacity-0" : "opacity-100"}`}>
          <img
            src={item.image}
            alt={item.name}
            className="w-20 h-20  z-10 object-cover rounded-lg p-2"
          />
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              width: "1px",
              boxShadow: `0px 0px 40px 25px ${Rarities.find((rarity) => rarity.id == item.rarity)?.color
                }`,
            }}
          />
          <div className="text-white z-10">{item.name}</div>
        </div>
        <div className={`absolute top-0 w-full h-full  flex flex-col transition-all duration-300 items-center ${isHovering ? "opacity-100" : "opacity-0"}`}
          style={{
            transform: `rotateY(180deg)`,
          }}
        >
          <Link to={`case/${item.case}`} className="z-10">
            <img
              src={caseImage}
              alt={"case"}
              className="h-20 object-cover rounded-full p-2 pb-0"
            /></Link>
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              width: "1px",
              boxShadow: `0px 0px 40px 25px ${Rarities.find((rarity) => rarity.id == item.rarity)?.color
                }`,
            }}
          />
          <Link to={`profile/${user.id}`} className="absolute -bottom-2 flex items-center">
            <img
              src={user.profilePicture}
              alt={"case"}
              className="w-12 h-12  z-10 object-cover rounded-full p-2 transition-all hover:scale-110 "
            />
            <div className="z-10 text-base text-gray-200">{user.name.length > 20 ? `${user.name.slice(0, 20)}...` : user.name}</div>
          </Link>
        </div>

      </div>
    </div>
  );
};

export default CaseOpenedNotification;
