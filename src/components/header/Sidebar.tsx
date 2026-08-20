import { BsHeartFill, BsListCheck } from "react-icons/bs";
import { MdOutlineSell, MdOutlineAdminPanelSettings } from "react-icons/md";
import { FaHome, FaGift } from "react-icons/fa";
import { Link } from "react-router-dom";
import ClaimBonus from "../header/ClaimBonus";
import { useContext } from "react";
import UserContext from "../../UserContext";
import Monetary from "../Monetary";
import GiftTag from "./GiftTag";
import useGiftReady from "./useGiftReady";
import i18n from "../../i18n";
import { gameLinks, NavLink } from "./gameLinks";

interface Sidebar {
    closeSidebar: () => void;
}

const Sidebar: React.FC<Sidebar> = ({ closeSidebar }) => {
    const { userData } = useContext(UserContext);
    const giftReady = useGiftReady();
    const games = gameLinks();


    // same split as the navbar: games under their own heading, everything else above it
    const links: NavLink[] = [
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
            name: i18n.t("nav.topFan"),
            path: "/fandom",
            icon: <BsHeartFill className="text-2xl" />,
        },
        {
            name: i18n.t("nav.dailyGift"),
            path: "/gift",
            icon: <FaGift className="text-2xl" />,
            badge: giftReady ? <GiftTag /> : undefined,
        },
        ...(userData?.id ? [{
            name: i18n.t("nav.missions"),
            path: `/profile/${userData.id}?tab=missions`,
            icon: <BsListCheck className="text-2xl" />,
        }] : []),
        ...(userData?.isAdmin ? [{
            name: i18n.t("nav.backoffice"),
            path: "/backoffice",
            icon: <MdOutlineAdminPanelSettings className="text-2xl" />,
        }] : [])
    ];

    return (
        <div className="fixed top-0 left-0 bg-black bg-opacity-50 z-[100]">
            <div className="bg-[#19172D] p-4  w-screen h-screen overflow-y-auto">
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
                                {i18n.t("nav.kanicasino")}
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
                    <p className="mt-8 px-2 text-xs font-extrabold tracking-[0.16em] text-[#625F7E]">
                        {i18n.t("nav.games").toUpperCase()}
                    </p>
                    <div className="flex flex-col space-y-4 mt-3 pb-8">
                        {games.map((game) => (
                            <Link key={game.path} to={game.path} onClick={closeSidebar}>
                                <div className="flex items-center gap-4 p-2 text-white">
                                    {game.icon}
                                    <p className="">{game.name}</p>
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