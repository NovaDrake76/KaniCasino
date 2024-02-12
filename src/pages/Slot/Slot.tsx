import { useContext, useEffect, useRef, useState } from 'react';
import Game from './Game';
import { spinSlots } from '../../services/games/GamesServices';
import { toast } from 'react-toastify';
import { SlotProps } from './Types';
import BigWinAlert from './BigWinAlert';
import RenderMike from './RenderMike';
import bigwin from "/bigwin.mp3"
import ValueViewer from './ValueViewer';
import UserContext from '../../UserContext';
// import { RotatingLines } from "react-loader-spinner";

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
    const [lostCount, setLostCount] = useState<number>(0);
    const [loadedImages, setLoadedImages] = useState<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const { userData, toogleUserFlow } = useContext(UserContext);

    const startAudio = () => {
        setTimeout(() => {
            if (audioRef.current) {
                audioRef.current.volume = 0.05;
                audioRef.current.play();
            }
        }, 2800);
    };

    const pauseAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };


    const handleClick = () => {
        if (openBigWin) {
            setOpenBigWin(false);
            pauseAudio();
        }
    };

    useEffect(() => {
        setTimeout(() => {
            setTotalWins(response?.totalPayout || 0);
        }, 3000);
    }, [response]);

    useEffect(() => {
        window.addEventListener('click', handleClick);

        return () => {
            window.removeEventListener('click', handleClick);
        };
    }, [openBigWin]);


    const handleSpin = async () => {

        if (userData == null) {
            toogleUserFlow(true);
            return;
        }
        setOpenBigWin(false);
        setTotalWins(0);

        if (userData?.walletBalance < betAmount) {
            toast.error("Insufficient funds");
            return;
        }

        try {
            const response = await spinSlots(betAmount);
            setResponse(response);
            setGrid(response.gridState);
            setWinningLines(response?.lastSpinResult.map((result: { line: any; }) => result.line) || [])
            setIsSpinning(true);
            if (response.totalPayout >= betAmount * 8) {
                setOpenBigWin(true);
                startAudio();
            }

            if (response.totalPayout == 0) {
                setLostCount(lostCount + 1);
            } else {
                setLostCount(0);
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
                className={`w-6 h-10 bg-transparent text-white font-bold py-2 px-4 
                       rounded-full transition-all border-4 hover:border-unique flex items-center justify-center
                       border-[#ECA823]`}
            >
                {type === "subtract" ? "-" : "+"}
            </button>
        );
    };

    const getCurrentMike = () => {
        if (response) {
            if (openBigWin) {
                return "jackpot";
            } else if (response?.totalPayout > 0) {
                return "win";
            } else if (lostCount >= 3) {
                return "losing";
            } else {
                return "normal";
            }
        }
    }

    return (
        <div className='w-full flex justify-center -mt-10'>
            {
                openBigWin && <BigWinAlert value={response?.totalPayout || 0} />
            }
            <audio
                ref={audioRef}
                src={bigwin}
            />
            {/* <div className={`md:p-4 pb-1 ${loadedImages > 1 ? "flex flex-col items-center justify-center" : "hidden"}`}>
                <RotatingLines strokeColor="grey" strokeWidth="5" animationDuration="0.75" width="50px" visible={true} />
                <span className='text-[#656569]'>loading assets ({loadedImages}/4)</span>
            </div> */}

            <div className={`md:p-4 pb-1  `}>
                <RenderMike status={
                    getCurrentMike() as "normal" | "win" | "losing" | "jackpot"
                } />
                <Game grid={grid} isSpinning={isSpinning} data={response} winningLines={winningLines} loadedImages={loadedImages} setLoadedImages={setLoadedImages} />


                <div className="flex flex-col justify-center p-4 bg-[#B52D26] border-t-4 border-red-800 gap-4"
                    style={{
                        boxShadow: "inset 0px 0px 60px 4px #000",
                    }}>

                    <div className="flex w-full items-center justify-center gap-2">
                        {
                            ["balance", "bet", "wins"].map((type) => <ValueViewer key={type} type={type as "balance" | "bet" | "wins"} betAmount={betAmount} totalWins={totalWins} />
                            )
                        }
                    </div>
                    <div className="flex items-center justify-center gap-8">
                        {handleChangeBet("subtract")}
                        <button onClick={handleSpin} disabled={isSpinning} className="bg-[#25D160] w-16 h-16 text-white 
                            font-bold py-2 px-4 rounded-full transition-all 
                            hover:bg-[#b0ff7c] hover:border-unique border-4 border-[#ECA823] text-sm flex items-center justify-center"
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
