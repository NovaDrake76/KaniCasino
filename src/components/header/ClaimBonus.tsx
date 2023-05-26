import MainButton from "../MainButton";
import { claimBonus } from "../../services/users/UserServices";
import { toast } from "react-toastify";


interface IBonus {
    setHaveBonus: React.Dispatch<React.SetStateAction<boolean>>;
    setOpenUserFlow: React.Dispatch<React.SetStateAction<boolean>>;
    toogleUserData: React.Dispatch<React.SetStateAction<any>>;
    userData: any;
}

const ClaimBonus: React.FC<IBonus> = ({ setHaveBonus, setOpenUserFlow, toogleUserData, userData }) => {


    const claimUserBonus = async () => {
        try {
            let res = await claimBonus();
            setOpenUserFlow(false);
            setHaveBonus(false);
            console.log(res)
            toast.success(res.message, {
                theme: "dark",
            });
            toogleUserData(
                {
                    ...userData,
                    walletBalance: userData?.walletBalance + res.value,
                    nextBonus: res.nextBonus
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
            text="Claim Bonus"
            onClick={() => claimUserBonus()}
        />
    )
}

export default ClaimBonus;