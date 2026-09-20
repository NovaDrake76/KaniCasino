import React, { useEffect, useState } from "react"
import AvatarMenu from "./AvatarMenu";
import { FaRegBell } from "react-icons/fa";
import { FaRegBellSlash } from "react-icons/fa";
import ClaimBonus from "../ClaimBonus";
import { BiWallet } from "react-icons/bi";
import Monetary from "../../Monetary";
import { User } from '../../../components/Types';

interface RightContentProps {
    loading: boolean;
    userData: User;
    openNotifications: boolean;
    setOpenNotifications: React.Dispatch<React.SetStateAction<boolean>>;
    Logout: () => void;
}

const RightContent: React.FC<RightContentProps> = ({ loading, userData, openNotifications, setOpenNotifications, Logout }) => {
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
    const isMobile = window.innerWidth <= 768

    useEffect(() => {
        if (userData?.hasUnreadNotifications) {
            setHasUnreadNotifications(true)
        }
    }, [userData?.hasUnreadNotifications])

    useEffect(() => {
        if (openNotifications) {
            setHasUnreadNotifications(false)
        }
    }, [openNotifications])

    return (
        <div className="flex items-center gap-4">
            <div className="hidden md:flex ">
                {
                    !loading && (
                        //button to claim bonus (also offers the optional watch-ad reward)
                        <ClaimBonus bonusDate={userData?.nextBonus} userData={userData} potMode={!!userData?.features?.daisu} />
                    )
                }
            </div>

            {!loading && (
                <div className="flex items-center gap-2 text-green-400 font-normal text-lg hover:text-green-300 transition-all ">
                    <BiWallet className="text-2xl hidden md:block " />
                    <div className="max-w-[80px] md:max-w-[140px] overflow-hidden text-sm md:text-lg truncate ">
                        <Monetary value={Math.floor(userData?.walletBalance)} />
                    </div>
                </div>
            )}

            <div className="relative cursor-pointer" onClick={() => setOpenNotifications(!openNotifications)}
            >
                {
                    openNotifications ? (
                        <div>
                            <FaRegBellSlash style={{
                                fontSize: "20px",
                            }} />
                        </div>) : (
                        <div>
                            <FaRegBell style={{
                                width: "20px",
                            }} />
                        </div>)
                }
                {
                    hasUnreadNotifications && !openNotifications && (
                        <div className="absolute -top-1 -right-[2px] w-3 h-3 bg-red-500 rounded-full " />
                    )

                }
            </div>
            <AvatarMenu userData={userData} loading={loading} size={isMobile ? "small" : "medium"} logout={Logout} />
        </div>
    )
}

export default RightContent
