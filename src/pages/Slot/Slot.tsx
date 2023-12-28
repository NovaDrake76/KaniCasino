import { useContext, useEffect, useState } from 'react';
import Game from './Game';
import { spinSlots } from '../../services/games/GamesServices';
import { toast } from 'react-toastify';
import { SlotProps } from './Types';
import { FaCoins } from "react-icons/fa";
import { BiWallet } from "react-icons/bi";
import { TbPigMoney } from "react-icons/tb";
import UserContext from '../../UserContext';
import BigWinAlert from './BigWinAlert';
import Monetary from '../../components/Monetary';

const renderPlaceholder = () => {
    const options = ['red', 'blue', 'green', 'yin_yang', 'hakkero', 'yellow', 'wild'];
    return Array.from({ length: 9 }, () => options[Math.floor(Math.random() * options.length)]);
};

const Slots = () => {
    const [grid, setGrid] = useState<string[]>(renderPlaceholder());
    const [response, setResponse] = useState<SlotProps | null>(null);
    const [betAmount, setBetAmount] = useState<number>(10);
    const [isSpinning, setIsSpinning] = useState<boolean>(false);
    const [winningLines, setWinningLines] = useState<any[]>([]);
    const [totalWins, setTotalWins] = useState<number>(0);
    const [openBigWin, setOpenBigWin] = useState<boolean>(false);
    const { userData } = useContext(UserContext);

    const handleClick = () => {
        if (openBigWin) {
            setOpenBigWin(false);
        }
    };


    useEffect(() => {
        setTimeout(() => {
            setTotalWins(totalWins + (response?.totalPayout || 0));
        }, 3000);
    }, [response]);

    useEffect(() => {

        window.addEventListener('click', handleClick);

        return () => {
            window.removeEventListener('click', handleClick);
        };
    }, [openBigWin]);

    const handleSpin = async () => {
        setOpenBigWin(false);
        try {
            const response = await spinSlots(betAmount);
            setResponse(response);
            setGrid(response.gridState);
            setWinningLines(response?.lastSpinResult.map((result: { line: any; }) => result.line) || [])
            setIsSpinning(true);
            if (response.totalPayout >= betAmount * 8) {
                setOpenBigWin(true);
            }

            setTimeout(() => {
                setIsSpinning(false);
            }, 3000);
        } catch (e: any) {
            console.error(e.response?.data.message || "Error spinning slots");
            toast.error(e.response?.data.message || "Error spinning slots");
            setIsSpinning(false);
        }
    };

    const handleChangeBet = (type: "add" | "subtract") => {
        return (
            <button
                onClick={() => {
                    const newBetAmount = type === "subtract" ? betAmount / 2 : betAmount * 2;
                    if (newBetAmount >= 1 && newBetAmount <= 50000) {
                        setBetAmount(newBetAmount);
                    }
                }}
                className={`w-8 h-10 bg-transparent text-white font-bold py-2 px-4 
                       rounded-full transition-all border-4 hover:border-unique flex items-center justify-center
                       border-[#ECA823]`}
            >
                {type === "subtract" ? "-" : "+"}
            </button>
        );
    };

    const renderValueViewer = (type: "balance" | "bet" | "wins") => {
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

    return (
        <div className='w-full flex items-center justify-center'>
            {
                openBigWin && <BigWinAlert betAmount={betAmount} value={response?.totalPayout || 0} />
            }

            <div className=" md:p-4">
                <Game grid={grid} isSpinning={isSpinning} data={response} winningLines={winningLines} />

                <div className="flex flex-col justify-center p-4 bg-[#B52D26] border-t-4 border-red-800 gap-4"
                    style={{
                        boxShadow: "inset 0px 0px 60px 4px #000",
                    }}>

                    <div className="flex w-full items-center justify-center gap-2">
                        {
                            ["balance", "bet", "wins"].map((type) => renderValueViewer(type as "balance" | "bet" | "wins"))
                        }
                    </div>
                    <div className="flex items-center justify-center gap-8">
                        {handleChangeBet("subtract")}
                        <button onClick={handleSpin} disabled={isSpinning} className="bg-[#25D160] w-20 h-20 text-white 
                     font-bold py-2 px-4 rounded-full transition-all hover:bg-[#b0ff7c] hover:border-unique border-4 border-[#ECA823]"
                            style={{
                                boxShadow: "inset 0px 0px 14px 1px #000",
                            }}
                        >
                            Spin
                        </button>
                        {handleChangeBet("add")}
                    </div>
                </div>

            </div >
        </div>

    );
};

export default Slots;
