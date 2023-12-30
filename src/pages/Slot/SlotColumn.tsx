import { useState, useRef, useEffect } from "react";
import { RotatingLines } from "react-loader-spinner";

interface SlotColumnProps {
    symbols: string[];
    isSpinning: boolean;
    position: number;
    winningLines?: any[];
}

const SlotColumn: React.FC<SlotColumnProps> = ({ symbols, isSpinning, position, winningLines }) => {
    const rollsize = 5260;
    const [rouletteItems, setRouletteItems] = useState<any[]>([]);
    const [translateValue, setTranslateValue] = useState<string>(`-${rollsize}px`);
    const [loading, setLoading] = useState<boolean>(true);

    const rouletteRef = useRef<HTMLDivElement | null>(null);
    const options = ['red', 'blue', 'green', 'yin_yang', 'hakkero', 'yellow', 'wild'];

    const createRouletteItems = () => {
        const newItems = symbols.slice();
        for (let i = 0; i < 46; i++) {
            newItems.unshift(options[Math.floor(Math.random() * options.length)]);
        }
        newItems[47] = symbols[0];
        newItems[48] = symbols[1];
        newItems[49] = symbols[2];
        setRouletteItems(newItems);
    };

    const handleImageLoad = () => {
        setLoading(false);
    };


    useEffect(() => {
        createRouletteItems();
    }, [symbols]);


    useEffect(() => {
        if (isSpinning) {
            const randomTranslateY = -rollsize;
            setTranslateValue(`${randomTranslateY}px`);
        }
    }, [isSpinning]);


    const calculateDelay = (position: number) => {
        if (position === 0) {
            return "spin 2s cubic-bezier(0.1, 0, 0.2, 1)"
        } else if (position === 1) {
            return "spin 2.4s cubic-bezier(0.1, 0, 0.2, 1)"
        } else {
            return "spin 2.8s cubic-bezier(0.1, 0, 0.2, 1)"
        }
    };


    useEffect(() => {
        if (rouletteRef.current && isSpinning) {
            rouletteRef.current.style.animation = calculateDelay(position);
        } else if (rouletteRef.current) {
            rouletteRef.current.style.animation = "";
            rouletteRef.current.style.transform = `translateY(${translateValue})`;

        }
    }, [isSpinning, translateValue]);


    const getSymbolImage = (symbol: string) => {

        const images: { [key: string]: string } = {
            red: '/images/slot/red.webp',
            blue: '/images/slot/shangai.webp',
            green: '/images/slot/lily.webp',
            yin_yang: '/images/slot/yin.webp',
            hakkero: '/images/slot/hakkero.webp',
            yellow: '/images/slot/green.webp',
            wild: "/images/slot/wild.webp"
        };

        return images[symbol];
    }

    const isWinningSymbol = (index: number) => {
        if (index < 46) return false;

        for (const line of winningLines ?? []) {
            if (line.startsWith('Horizontal')) {
                if (line.endsWith('1') && index === 47) {
                    return true;
                } else if (line.endsWith('2') && index === 48) {
                    return true;
                }
                else if (line.endsWith('3') && index === 49) {
                    return true;
                }
            }

            if (line.startsWith('Diagonal')) {
                if (line.endsWith('1') && position == 0 && index === 47) {
                    return true;
                } else if (line.endsWith('1') && position == 2 && index === 49) {
                    return true;
                }

                else if (position == 1 && index === 48) {
                    return true;
                }

                else if (line.endsWith('2') && position == 0 && index === 49) {
                    return true;
                } else if (line.endsWith('2') && position == 2 && index === 47) {
                    return true;
                }
            }
        }

        return false;
    }

    return (
        <div className="max-h-[340px] overflow-hidden ">
            <div ref={rouletteRef} >
                {
                    rouletteItems.map((symbol, index) => (
                        <div key={index} className={`w-28 h-28 relative  p-2 ${isWinningSymbol(index) ? 'animate-winner' : ''}`} >
                            <div className={`w-full h-full ${isWinningSymbol(index) ? 'winner-item' : ''}`}>
                                {
                                    loading && <div className="absolute inset-0 flex items-center justify-center">
                                        <RotatingLines
                                            strokeColor="grey"
                                            strokeWidth="5"
                                            animationDuration="0.75"
                                            width="50px"
                                            visible={true}
                                        />
                                    </div>
                                }
                                <img src={getSymbolImage(symbol)} alt={symbol}
                                    className={`w-full h-full z-10 ${loading ? "hidden" : ""}`}
                                    onLoad={handleImageLoad} />
                                {isWinningSymbol(index) && isSpinning == false &&
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div
                                            className="w-auto mt-1 h-1 rounded-full shadow-lg transition-all -z-10 "
                                            style={{
                                                boxShadow: "0px 0px 35px 28px #FFCC00",
                                            }}
                                        />
                                        {

                                            //draw a line connecting the winning symbols
                                            winningLines?.map((line, lineIndex) => {
                                                const rotations = [];

                                                if (line.startsWith('Horizontal') && ((line.endsWith('1') && index === 47) || (line.endsWith('2') && index === 48) || (line.endsWith('3') && index === 49))) {
                                                    rotations.push('rotate(0deg)');
                                                }

                                                if (line.startsWith('Diagonal')) {
                                                    if ((line.endsWith('1') && position == 0 && index === 47) || (line.endsWith('1') && position == 2 && index === 49)) {
                                                        rotations.push('rotate(45deg)');
                                                    } else if ((line.endsWith('2') && position == 0 && index === 49) || (line.endsWith('2') && position == 2 && index === 47)) {
                                                        rotations.push('rotate(-45deg)');
                                                    } else if (position == 1 && index === 48) {
                                                        if (winningLines.includes('Diagonal 1') && winningLines.includes('Diagonal 2')) {
                                                            rotations.push('rotate(45deg)', 'rotate(-45deg)');
                                                        } else if (winningLines.includes('Diagonal 1')) {
                                                            rotations.push('rotate(45deg)');
                                                        } else if (winningLines.includes('Diagonal 2')) {
                                                            rotations.push('rotate(-45deg)');
                                                        }
                                                    }
                                                }

                                                return rotations.map((rotation, i) => (
                                                    <div
                                                        key={`${lineIndex}-${i}`}
                                                        className="absolute w-[calc(200%)] h-1 bg-unique  -z-10"
                                                        style={{ transform: rotation }}
                                                    />
                                                ));
                                            })

                                        }
                                    </div>}
                                {/* <div className="absolute z-10">{index}</div> */}
                            </div>
                        </div>
                    ))
                }
            </div>
            <style>{`
             @keyframes spin {
                from {
                    transform: translateY(0%);
                }
                to {
                    transform: translateY(${translateValue});
                }
            }

            @keyframes animate-winner {
                0% {
                    transform: scale(1);
                }
                100% {
                    transform: scale(1.05);
                }
            }

            .winner-item {
                animation: animate-winner 0.8s infinite alternate;
            }
        `}</style>

        </div>
    );

};

export default SlotColumn;