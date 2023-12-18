import React, { useState } from "react"
import Avatar from "../../Avatar";
import { FaRegBell } from "react-icons/fa";
import { FaRegBellSlash } from "react-icons/fa";
import ClaimBonus from "./ClaimBonus";
import { IoMdExit } from "react-icons/io";
import { BiWallet } from "react-icons/bi";

interface RightContentProps {
    loading: boolean;
    userData: any;
    setOpenUserFlow: React.Dispatch<React.SetStateAction<boolean>>;
    openNotifications: boolean;
    setOpenNotifications: React.Dispatch<React.SetStateAction<boolean>>;
    toogleUserData: React.Dispatch<React.SetStateAction<any>>;
    Logout: () => void;
}

const RightContent: React.FC<RightContentProps> = ({ loading, userData, setOpenUserFlow, openNotifications, setOpenNotifications, toogleUserData, Logout }) => {

    return (
        <div className="flex items-center gap-4">
            <div className="hidden md:flex ">
                {
                    !loading && (
                        //button to claim bonus 
                        <ClaimBonus bonusDate={userData?.nextBonus} setOpenUserFlow={setOpenUserFlow} toogleUserData={toogleUserData} userData={userData} />
                    )

                }
            </div>

            {!loading && (
                <div className="flex items-center gap-2 text-green-400 font-normal text-lg hover:text-green-300 transition-all invisible md:visible">
                    <BiWallet className="text-2xl" />
                    <div className="max-w-[80px] md:max-w-none overflow-hidden truncate">
                        {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "DOL",
                        })
                            .format(userData?.walletBalance)
                            .replace("DOL", "K₽")}
                    </div>
                </div>
            )}

            <div>
                {
                    openNotifications ? (
                        <div className="cursor-pointer "
                            onClick={() => setOpenNotifications(false)}
                        >
                            <FaRegBellSlash style={{
                                fontSize: "20px",
                            }} />
                        </div>) : (
                        <div className="cursor-pointer"
                            onClick={() => setOpenNotifications(true)}
                        >
                            <FaRegBell style={{
                                width: "20px",
                            }} />
                        </div>)
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
