import { BsCoin } from "react-icons/bs";
import { GiUpgrade, GiCrossedSwords } from "react-icons/gi";
import { MdOutlineSell, MdOutlineAdminPanelSettings } from "react-icons/md";
import { SlPlane } from "react-icons/sl";
import { FaHome, FaGift } from "react-icons/fa";
import { Link } from "react-router-dom";
import { TbCat } from "react-icons/tb";
import ClaimBonus from "../header/ClaimBonus";
import { useContext } from "react";
import UserContext from "../../UserContext";
import Monetary from "../Monetary";
import GiftTag from "./GiftTag";
import useGiftReady from "./useGiftReady";
import i18n from "../../i18n";

interface Sidebar {
    closeSidebar: () => void;
}

const Sidebar: React.FC<Sidebar> = ({ closeSidebar }) => {
    const { userData } = useContext(UserContext);
    const giftReady = useGiftReady();


    const links: { name: string; path: string; icon: JSX.Element; badge?: JSX.Element }[] = [
        {
            name: i18n.t("nav.home"),
            path: "/",
            icon: <FaHome className="text-2xl" />,
        },
        {
            name: i18n.t("nav.market"),
            path: "/marketplace",
            icon: <MdOutlineSell className="text-2xl" />,
        },
        {
            name: i18n.t("nav.coinFlip"),
            path: "/coinflip",
            icon: <BsCoin className="text-2xl" />,
        },
        {
            name: i18n.t("nav.crash"),
            path: "/crash",
            icon: <SlPlane className="text-2xl" />,
        },
        {
            name: i18n.t("nav.upgrade"),
            path: "/upgrade",
            icon: <GiUpgrade className="text-2xl" />,
        },
        {
            name: i18n.t("nav.slots"),
            path: "/slot",
            icon: <TbCat className="text-2xl" />,
        },
        {
            name: i18n.t("nav.dailyGift"),
            path: "/gift",
            icon: <FaGift className="text-2xl" />,
            badge: giftReady ? <GiftTag /> : undefined,
        },
        {
            name: i18n.t("nav.caseBattles"),
            path: "/battles",
            icon: <GiCrossedSwords className="text-2xl" />,
        },
        ...(userData?.isAdmin ? [{
            name: i18n.t("nav.backoffice"),
            path: "/backoffice",
            icon: <MdOutlineAdminPanelSettings className="text-2xl" />,
        }] : [])
    ];

    return (
        <div className="fixed top-0 left-0 bg-black bg-opacity-50 z-[100]">
            <div className="bg-[#19172D] p-4  w-screen min-h-[100vh]">
                <div className="flex flex-col">
                    <div className="flex justify-between">
                        <div
                            className="flex items-center gap-2  justify-center "
                        >
                            <img
                                src="/images/logo.webp"
                                alt={i18n.t("common.logo")}
                                className="w-16 h-16 object-contain"
                            />
                            <div className="font-normal text-xl text-white">
                                KaniCasino
                            </div>
                        </div>
                        <button onClick={closeSidebar} className="bg-transparent">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div className="mt-8">

                        <div className="text-green-400 py-1 ">
                            Balance:{" "}
                            <Monetary value={Math.floor(userData?.walletBalance)} />
                        </div>

                        <ClaimBonus bonusDate={userData?.nextBonus} userData={userData} />
                    </div>
                    <div className="flex flex-col space-y-4 mt-6">
                        {links.map((link, index) => (
                            <Link key={index} to={link.path} onClick={closeSidebar}>
                                <div className="flex items-center gap-4 p-2 text-white">
                                    {link.icon}
                                    <p className="">{link.name}</p>
                                    {link.badge}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


export default Sidebar;