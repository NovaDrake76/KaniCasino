import { FaCoins } from "react-icons/fa";
import { BiWallet } from "react-icons/bi";
import { TbPigMoney } from "react-icons/tb";
import Monetary from '../../components/Monetary';
import UserContext from '../../UserContext';
import { useContext } from "react";


interface ValueViewerProps {
    type: "balance" | "bet" | "wins";
    betAmount: number;
    totalWins: number;
}


const ValueViewer: React.FC<ValueViewerProps> = ({ type, betAmount, totalWins }) => {
    const { userData } = useContext(UserContext);

    return (
        <div className="flex bg-black/30 p-2 rounded w-full md:w-[128px] items-center justify-between gap-4 text-sm">
            <span className='text-unique'>
                {
                    type == "balance" ? <BiWallet /> :
                        type == "bet" ? <FaCoins /> :
                            <TbPigMoney />
                }
            </span>
            <span className='truncate'>
                {
                    type == "balance" ?
                        <Monetary value={userData?.walletBalance} />
                        :
                        type == "bet" ? <Monetary value={betAmount} />
                            :
                            <Monetary value={totalWins} />

                }
            </span>
        </div>
    )
}

export default ValueViewer;