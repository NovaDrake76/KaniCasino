import React, { useEffect, useState } from "react";
import PlayerPreview from "../PlayerPreview";

interface GameHistory {
    gameState: any;
}

const LiveBets: React.FC<GameHistory> = ({ gameState }) => {
    const [totalBets, setTotalBets] = useState<number>(0);
    const [isHovering, setIsHovering] = useState<boolean>(false);

    useEffect(() => {
        if (gameState) {
            let totalBets = 0;
            for (let player in gameState.gameBets) {
                totalBets += gameState.gameBets[player];
            }
            setTotalBets(totalBets);
        }
    }, [gameState]);

    const handleHover = () => {
        setIsHovering(!isHovering);
    };

    return (
        <div className="flex flex-col px-8 py-4 bg-[#212031] rounded file:h-min lg:w-[1140px] w-full">

            <div className="flex flex-col">
                <div className="flex items-center justify-between py-4">
                    <span className="font-bold text-sm">Total Bets</span>
                    <span className="font-bold text-sm">C₽{totalBets}</span>
                </div>

                <div className="flex items-center w-full justify-between p-2 bg-[#1A152B] rounded">
                    <span className="font-bold text-sm">User</span>
                    <div className="hidden w-1/4 justify-between md:flex">
                        {
                            ["Bet", "Payout", "Profit"].map((item) => (
                                <span key={item} className="font-bold text-sm">{item}</span>
                            ))

                        }
                    </div>
                </div>

                {gameState && gameState.gamePlayers && Object.keys(gameState.gamePlayers).map(playerId => {
                    const player = gameState.gamePlayers[playerId];
                    const bet = gameState.gameBets[playerId];
                    return (

                        <div className="flex items-center justify-between px-2 py-4 relative  border-b border-gray-700 " key={playerId}
                            onMouseEnter={handleHover}
                            onMouseLeave={handleHover}>
                            {
                                isHovering && (
                                    <PlayerPreview player={player} />
                                )
                            }
                            <a href={`/profile/${playerId}`} target="_blank" rel="noreferrer" className="text-white transition-all">
                                <div className="flex items-center gap-2">
                                    <img src={player.profilePicture} className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 " />
                                    <span className="font-bold text-sm">{player.username}</span>
                                </div>
                            </a>

                            <div className="flex justify-between w-1/4">
                                <span className="font-bold text-sm">C₽{bet}</span>
                                <span className={`font-bold text-sm ${player.payout && "text-green-500"}`}>{player.payout ? player.payout.toFixed(2) : '-'}</span>
                                <span className={`font-bold text-sm ${player.payout && "text-green-500"}`}>{player.payout ? `${(player.payout * bet).toFixed(2)}X ` : ' -'}</span>
                            </div>
                        </div>

                    );
                })}
            </div>
        </div>
    )
}

export default LiveBets;
