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
import i18n from "../../i18n";
import { Badge } from "../../services/badges/BadgeService";
import { bestDrop } from "./liveDrop";

interface CaseOpeningItem {
  id: string;
  caseImage: string;
  source?: string;
  timestamp: number;
  user: {
    id: string;
    name: string;
    profilePicture: string;
    badge?: Badge | null;
  };
  winningItems: BasicItem[];
}

interface Header {
  // the chat rail hangs under the navbar, so everything below the bar shifts across by it
  railPad: number;
  onlineUsers: number;
  recentCaseOpenings: CaseOpeningItem[];
  notification: any;
  setNotification: React.Dispatch<React.SetStateAction<any>>;
}

interface ItemsQueue {
  id: string;
  items: BasicItem[];
  caseImages: string[];
  // where the drop came from. absent means a case was opened, which is every drop the
  // feed carried before the upgrade game started reporting its wins.
  source?: string;
  user: {
    id: string;
    name: string;
    profilePicture: string;
    badge?: Badge | null;
  };
}

const Header: React.FC<Header> = ({ onlineUsers, recentCaseOpenings, notification, setNotification, railPad }) => {

  const [openNotifications, setOpenNotifications] = useState<boolean>(false);
  const [openSidebar, setOpenSidebar] = useState<boolean>(false);
  const [ItemsQueue, setItemsQueue] = useState<ItemsQueue[]>([]);


  const { isLogged, openUserFlow } = useContext(UserContext);
  const navigate = useNavigate();
  const isHome = window.location.pathname === "/";
  // latches on the first open and never resets: the panel keeps its state, and its
  // transition still needs it in the tree after it closes
  const [everOpened, setEverOpened] = useState<boolean>(false);
  useEffect(() => {
    if (openUserFlow) setEverOpened(true);
  }, [openUserFlow]);

  const items = [
    {
      name: i18n.t("nav.online"),
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
          id: opening.id,
          items: opening.winningItems,
          caseImages: [opening.caseImage],
          source: opening.source,
          user: opening.user,
        };
      });
      newQueue.push(...newItems);
      setItemsQueue(newQueue);
    }
  }, [recentCaseOpenings]);


  return (
    <div className="flex flex-col p-4 w-full justify-center ">
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
              : "opacity-100 z-overlay "
              }`}
          >
            {/* only built once the panel has been opened. it was always mounted and merely
                hidden with css, and mounting it is what pulls in google's sign-in script:
                ~160 KiB fetched on every page view for a button most visitors never see.
                it stays mounted afterwards so the open/close transition still runs. */}
            {everOpened && <UserFlow />}
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
            <span className="text-[#9793ba] text-[10px] ">{i18n.t("common.liveDrop")}</span>

            <div className="flex h-28 bg-[#141225] ">
              <div className="flex overflow-hidden justify-start transition-all">
                {ItemsQueue.map((opening) => {
                  const best = bestDrop(opening.items);
                  if (!best) return null;
                  return (
                    <CaseOpenedNotification
                      key={opening.id}
                      item={best}
                      others={opening.items.length - 1}
                      caseImage={opening.caseImages[0]}
                      source={opening.source}
                      user={opening.user}
                    />
                  );
                })}

              </div>
            </div>
          </div>
        </div>
      )}
      {
        !isHome && (
          <div className="px-4 pt-3 pb-1 transition-[padding] duration-200" style={{ paddingLeft: railPad + 16 }}>
            <div className="flex items-center gap-2 text-[#84819a] cursor-pointer w-fit" onClick={() => navigate(-1)}>
              <BiArrowBack />
              <span>{i18n.t("header.back")}</span>
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