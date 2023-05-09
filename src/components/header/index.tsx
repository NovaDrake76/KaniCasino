import { useContext, useEffect, useState } from "react";
import UserFlow from "./userFlow";
import Navbar from "./Navbar";
import UserContext from "../../UserContext";
import { ImConnection } from "react-icons/im";
import CaseOpenedNotification from "./CaseOpenedNotification";

interface Header {
  onlineUsers: number;
  recentCaseOpenings: Array<any>;
}

const Header: React.FC<Header> = ({ onlineUsers, recentCaseOpenings }) => {
  const [openUserFlow, setOpenUserFlow] = useState<boolean>(false);
  const isLogged = useContext(UserContext);

  useEffect(() => {
    if (isLogged) {
      setOpenUserFlow(false);
    }
  }, [isLogged]);

  const items = [
    {
      name: "ONLINE",
      icon: <ImConnection />,
      value: onlineUsers,
    },
  ];

  return (
    <div className="flex flex-col p-4 w-screen justify-center ">
      <div className="flex pb-2 items-center">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 text-green-400 text-sm font-normal"
          >
            {item.icon}
            <div>{item.value}</div>
            <div className="text-[#84819a] text-sm">{item.name}</div>
          </div>
        ))}
      </div>
      <Navbar openUserFlow={openUserFlow} setOpenUserFlow={setOpenUserFlow} />
      <div className="flex  items-center justify-center ">
        <div className="flex items-center justify-center relative w-full max-w-[1920px]">
          <div
            className={`absolute flex justify-end mt-16 left-[99%] transition-all duration-300 ${
              openUserFlow === false
                ? "opacity-0 -z-10 h-0 overflow-hidden -mt-36"
                : "opacity-100 z-20 "
            }`}
          >
            <UserFlow />
          </div>
        </div>
      </div>
      {recentCaseOpenings.length > 0 && (
        <div className="flex flex-col gap-1 pt-1 items-center justify-center ">
          <div className="flex flex-col max-w-[1920px] w-full">
            <span className="text-[#9793ba] text-[10px] ">LIVE DROP</span>

            <div className="flex h-28 bg-[#141225] ">
              <div className="flex overflow-hidden justify-start transition-all">
                {recentCaseOpenings.map((opening, index) => (
                  <CaseOpenedNotification
                    key={index}
                    item={opening.item}
                    username={"a"}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
