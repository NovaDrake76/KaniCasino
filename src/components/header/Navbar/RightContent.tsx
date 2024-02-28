import React, { useEffect, useState } from "react"
import Avatar from "../../Avatar";
import { FaRegBell } from "react-icons/fa";
import { FaRegBellSlash } from "react-icons/fa";
import ClaimBonus from "../ClaimBonus";
import { IoMdExit } from "react-icons/io";
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
                        //button to claim bonus 
                        <ClaimBonus bonusDate={userData?.nextBonus} userData={userData} />
                    )
                }
            </div>

            {!loading && (
                <div className="flex items-center gap-2 text-green-400 font-normal text-lg hover:text-green-300 transition-all invisible md:visible">
                    <BiWallet className="text-2xl" />
                    <div className="max-w-[80px] md:max-w-[140px] overflow-hidden truncate">
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
            <Avatar image={userData?.profilePicture} loading={loading} id={userData?.id} size="medium" level={userData?.level} showLevel={true} />
            <div
                className="text-[#625F7E] font-normal text-lg cursor-pointer hover:text-gray-200 transition-all "
                onClick={Logout}
            >
                <IoMdExit className="text-2xl" />
            </div>
        </div>
    )
}

export default RightContent
