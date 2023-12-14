import { motion } from "framer-motion";
import Videos from "./Videos";
import { Key } from "react";

interface GameHistory {
    crashPoint: number | null;
    multiplier: number;
    animationSrc: string;
    setAnimationSrc: any;
    gameEnded: boolean;
    countDown: number;
    up: string;
    idle: string;
    falling: string;
    history: any;
}

const GameContainer: React.FC<GameHistory> = ({ crashPoint, multiplier, animationSrc, gameEnded, countDown, setAnimationSrc, up, idle, falling, history }) => {

    // Calculate the animation speed based on the multiplier, but don't be faster than 200ms
    const animationSpeed = Math.max(50 / multiplier, 50);

    const backgroundStyle = gameEnded
        ? { backgroundColor: '#19172D' }
        : {
            background: `linear-gradient(to right, var(--color1), var(--color2), var(--color3), var(--color6))`,
            backgroundSize: '600% 100%',
            animation: `gradient ${animationSpeed}s linear infinite`,
        };

    return (
        <div className="flex flex-col">
            <div className="flex lg:w-[800px] border-b border-gray-700  p-4">
                <div className="flex rounded items-center flex-col justify-center w-full h-[340px] relative "
                    style={backgroundStyle}
                >

                    {
                        gameEnded && <div className="absolute top-0 left-0 p-2">
                            <span>
                                Next game in: {countDown.toFixed(1)}
                            </span>
                        </div>
                    }
                    <div className={`font-semibold p-4 min-w-[250px] rounded text-2xl flex items-center z-10 justify-center -mt-32 ${gameEnded ? "bg-red-500" : "bg-[#212031] "}`}>
                        {
                            gameEnded ? <span>Crashed at {crashPoint && crashPoint.toFixed(2)}X</span>
                                : <div className="flex items-center justify-between w-[93%] ">
                                    <span>Multiplier:</span> {multiplier.toFixed(2)}X</div>}

                    </div>
                    <Videos
                        animationSrc={animationSrc}
                        setAnimationSrc={setAnimationSrc}
                        up={up}
                        idle={idle}
                        falling={falling} />
                </div>
            </div>
            <div className="flex w-screen lg:w-[800px] p-4 flex-col">
                <h3 className="mb-2 text-lg font-semibold">Game History:</h3>
                <div className="flex items-center gap-2 justify-end w-full overflow-hidden h-[24px]">
                    {history.map((e: { crashPoint: number | null }, i: Key) => (
                        <motion.div
                            key={i}
                            className={`min-h-[24px] rounded-lg p-2 ${e.crashPoint && e.crashPoint < 2 ? "bg-red-500" : "bg-green-500"}`}
                            initial={i === history.length - 1 ? { opacity: 0, x: 30 } : {}}
                            animate={i === history.length - 1 ? { opacity: 1, x: 0 } : {}}
                            transition={{ ease: "easeOut", duration: 1 }}
                        >
                            <span className="font-bold">{e.crashPoint}x</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default GameContainer