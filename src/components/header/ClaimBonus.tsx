import MainButton from "../MainButton";
import { claimBonus } from "../../services/users/UserServices";
import { toast } from "react-toastify";
import Countdown from "../Countdown";
import React, { useContext, useEffect, useState } from "react";
import UserContext from "../../UserContext";
import { User } from '../../components/Types';

interface IBonus {
    bonusDate: string;
    userData: User;
}

const ClaimBonus: React.FC<IBonus> = ({ bonusDate, userData }) => {
    const [bonusAvailable, setBonusAvailable] = useState(false);
    const { toogleUserFlow, toogleUserData } = useContext(UserContext);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (bonusDate) {
            const countdownDate = new Date(bonusDate).getTime();

            interval = setInterval(() => {
                const now = new Date().getTime();
                const distance = countdownDate - now;

                if (distance <= 0) {
                    setBonusAvailable(true);
                    clearInterval(interval);
                }
            }, 1000);
        }

        return () => {
            clearInterval(interval);
        };
    }, [bonusDate]);


    const claimUserBonus = async () => {
        try {
            const res = await claimBonus();
            toogleUserFlow(false)
            setBonusAvailable(false);
            toast.success(res.message, {
                theme: "dark",
            });
            toogleUserData(
                {
                    ...userData,
                    nextBonus: res.nextBonus,
                    walletBalance: userData.walletBalance + res.value
                }
            )
        } catch (error: any) {
            toast.error(`${error.response.data.message}!`, {
                theme: "dark",
            });
        }
    }

    return (
        <MainButton
            text={bonusAvailable ? "Claim Bonus" : <Countdown nextBonus={bonusDate} color={"#fff"} bold={false} />}
            onClick={() => claimUserBonus()}
            pulse={true}
            disabled={!bonusAvailable}

        />
    )
}

export default ClaimBonus;