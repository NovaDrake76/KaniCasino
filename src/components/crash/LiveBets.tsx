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
        <div className="flex flex-col p-4 bg-[#212031] rounded w-72 h-min ">

            <div className="flex border-t border-gray-700 flex-col ">
                <div className="flex items-center justify-between py-4">
                    <span className="font-bold text-sm">Total Bets</span>
                    <span className="font-bold text-sm">C₽{totalBets}</span>
                </div>
                {gameState && gameState.gamePlayers && Object.keys(gameState.gamePlayers).map(playerId => {
                    const player = gameState.gamePlayers[playerId];
                    const bet = gameState.gameBets[playerId];
                    return (
                        <div className="flex items-center justify-between py-2 relative" key={playerId}
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
                            <span className="font-bold text-sm">C₽{bet}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}

export default LiveBets;
