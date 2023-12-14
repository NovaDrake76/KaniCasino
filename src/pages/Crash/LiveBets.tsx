import React, { useEffect, useRef, useState } from "react";
import PlayerPreview from "../../components/PlayerPreview";
import Avatar from "../../components/Avatar";

interface GameHistory {
    gameState: any;
}

const LiveBets: React.FC<GameHistory> = ({ gameState }) => {
    const [totalBets, setTotalBets] = useState<number>(0);
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
    const hoverTimeoutRef = useRef<any>(null);

    useEffect(() => {
        if (gameState) {
            let totalBets = 0;
            for (const player in gameState.gameBets) {
                totalBets += gameState.gameBets[player];
            }
            setTotalBets(totalBets);
        }
    }, [gameState]);
    const handleMouseEnter = (playerId: string) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }

        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredPlayerId(playerId);
        }, 500);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setHoveredPlayerId(null);
    };

    return (
        <div className="flex flex-col px-8 py-4 bg-[#212031] rounded file:h-min lg:w-[1140px] w-full">

            <div className="flex flex-col">
                <div className="flex items-center justify-between py-4">
                    <span className="font-bold text-sm">Total Bets</span>
                    <span className="font-bold text-sm">K₽{totalBets}</span>
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
                        <div className="flex items-center justify-between px-2 py-4 relative border-b border-gray-700" key={playerId}
                            onMouseEnter={() => handleMouseEnter(playerId)}
                            onMouseLeave={handleMouseLeave}
                        >
                            {playerId === hoveredPlayerId && <PlayerPreview player={player} />}

                            <a href={`/profile/${playerId}`} target="_blank" rel="noreferrer" className="text-white transition-all">
                                <div className="flex items-center gap-2">
                                    <Avatar image={player.profilePicture} id={playerId} size="small" level={player.level} />
                                    <span className="font-bold text-sm">{player.username}</span>
                                </div>
                            </a>

                            <div className="flex justify-between w-1/4">
                                <span className="font-bold text-sm">K₽{bet}</span>
                                <span className={`font-bold text-sm ${player.payout && "text-green-500"}`}>{player.payout ? player.payout.toFixed(2) + 'X' : '-'}</span>
                                <span className={`font-bold text-sm ${player.payout && "text-green-500"}`}>{player.payout ? `${(player.payout * bet).toFixed(2)} ` : ' -'}</span>
                            </div>
                        </div>

                    );
                })}
            </div>
        </div>
    )
}

export default LiveBets;
