import { useContext, useEffect, useState } from "react";
import UserFlow from "./userFlow";
import Navbar from "./Navbar/Navbar";
import UserContext from "../../UserContext";
import { ImConnection } from "react-icons/im";
import CaseOpenedNotification from "./CaseOpenedNotification";
import { useNavigate } from "react-router-dom";
import { BiArrowBack } from "react-icons/bi";
import Notifications from "./Navbar/Notifications";
import { toast } from "react-toastify";
import Sidebar from "./Sidebar";
import { BasicItem } from "../Types";

interface CaseOpeningItem {
  caseImage: string;
  timestamp: number;
  user: {
    id: string;
    name: string;
    profilePicture: string;
  };
  winningItems: BasicItem[];
}

interface Header {
  onlineUsers: number;
  recentCaseOpenings: CaseOpeningItem[];
  notification: any;
  setNotification: React.Dispatch<React.SetStateAction<any>>;
}

interface ItemsQueue {
  items: BasicItem[];
  caseImages: string[];
  user: {
    id: string;
    name: string;
    profilePicture: string;
  };
}

const Header: React.FC<Header> = ({ onlineUsers, recentCaseOpenings, notification, setNotification }) => {

  const [openNotifications, setOpenNotifications] = useState<boolean>(false);
  const [openSidebar, setOpenSidebar] = useState<boolean>(false);
  const [ItemsQueue, setItemsQueue] = useState<ItemsQueue[]>([]);


  const { isLogged, openUserFlow } = useContext(UserContext);
  const navigate = useNavigate();
  const isHome = window.location.pathname === "/";

  const items = [
    {
      name: "ONLINE",
      icon: <ImConnection />,
      value: onlineUsers,
    },
  ];


  useEffect(() => {
    if (openNotifications === true) {
      setNotification([]);
    }
  }, [openNotifications]);

  useEffect(() => {
    if (notification?.message) {
      toast.info(notification.message);
    }
  }, [notification]);

  useEffect(() => {
    if (recentCaseOpenings.length > 0) {
      const newQueue = [];
      const newItems = recentCaseOpenings.map((opening) => {
        return {
          items: opening.winningItems,
          caseImages: [opening.caseImage],
          user: opening.user,
        };
      });
      newQueue.push(...newItems);
      setItemsQueue(newQueue);
    }
  }, [recentCaseOpenings]);


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
      <Navbar openNotifications={openNotifications} setOpenNotifications={setOpenNotifications} openSidebar={openSidebar} setOpenSidebar={setOpenSidebar} />
      <div className="flex  items-center justify-center ">
        <div className="flex items-center justify-center relative w-full max-w-[1920px]">
          <div
            className={`absolute flex justify-end mt-16 left-[99%] transition-all duration-300 ${openUserFlow === false
              ? "opacity-0 -z-10 h-0 overflow-hidden -mt-36"
              : "opacity-100 z-20 "
              }`}
          >
            <UserFlow />
          </div>
          {
            isLogged && openNotifications && (
              <Notifications openNotifications={openNotifications} setOpenNotifications={setOpenNotifications} />
            )
          }
        </div>
      </div>
      {recentCaseOpenings.length > 0 && (
        <div className="flex flex-col gap-1 pt-1 items-center justify-center ">
          <div className="flex flex-col max-w-[1920px] w-full">
            <span className="text-[#9793ba] text-[10px] ">LIVE DROP</span>

            <div className="flex h-28 bg-[#141225] ">
              <div className="flex overflow-hidden justify-start transition-all">
                {ItemsQueue.map((opening, index) => (
                  <CaseOpenedNotification
                    key={index}
                    item={opening.items[0]}
                    caseImage={opening.caseImages[0]}
                    user={opening.user}
                  />
                ))}

              </div>
            </div>
          </div>
        </div>
      )}
      {
        !isHome && (
          <div className="p-4">
            <div className="flex items-center gap-2 text-[#84819a] cursor-pointer w-fit" onClick={() => navigate(-1)}>
              <BiArrowBack />
              <span>Back</span>
            </div>
          </div>
        )
      }
      {openSidebar && <Sidebar closeSidebar={
        () => setOpenSidebar(false)
      } />}

    </div>
  );
};

export default Header;