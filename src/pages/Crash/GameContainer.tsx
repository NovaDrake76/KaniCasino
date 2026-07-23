import { motion } from "framer-motion";
import CrashGraph from "./CrashGraph";
import { Key } from "react";

interface GameHistory {
    crashPoint: number | null;
    multiplier: number;
    gameStarted: boolean;
    gameEnded: boolean;
    countDown: number;
    up: string;
    idle: string;
    falling: string;
    history: any;
}

// matches the countdown reset in Crash.tsx, itself just under the server's 12s betting window
const BETTING_COUNTDOWN_S = 10.7;

const GameContainer: React.FC<GameHistory> = ({ crashPoint, multiplier, gameStarted, gameEnded, countDown, up, idle, falling, history }) => {
    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-2 lg:w-[800px] border-b border-gray-700  p-4">
                <div className="flex rounded items-center flex-col justify-center w-full h-[340px] relative overflow-hidden bg-surface-nav">
                    <CrashGraph
                        gameStarted={gameStarted}
                        gameEnded={gameEnded}
                        multiplier={multiplier}
                        crashPoint={crashPoint}
                        up={up}
                        idle={idle}
                        falling={falling}
                    />

                    {
                        gameEnded && <div className="absolute top-0 left-0 p-2 z-10">
                            <span>
                                Next game in: {countDown.toFixed(1)}
                            </span>
                        </div>
                    }
                    <div className="z-10 -mt-10 pointer-events-none">
                        {
                            gameEnded ? (
                                <div className="flex flex-col items-center">
                                    <span className="text-5xl font-extrabold text-red-500 drop-shadow-lg">
                                        {crashPoint && crashPoint.toFixed(2)}x
                                    </span>
                                    <span className="text-sm font-semibold uppercase tracking-widest text-ink-soft mt-1">
                                        Crashed
                                    </span>
                                </div>
                            ) : (
                                <span className={`text-5xl font-extrabold drop-shadow-lg ${gameStarted ? "text-white" : "text-ink-muted"}`}>
                                    {multiplier.toFixed(2)}x
                                </span>
                            )}
                    </div>
                </div>
                {/* drains through the betting window; the empty track stays so the layout never shifts */}
                <div className="w-full h-1.5 bg-surface-raised overflow-hidden">
                    <div
                        className="h-full bg-accent-gold"
                        style={{
                            width: gameEnded ? `${Math.min((countDown / BETTING_COUNTDOWN_S) * 100, 100)}%` : "0%",
                            transition: "width 100ms linear",
                        }}
                    />
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
