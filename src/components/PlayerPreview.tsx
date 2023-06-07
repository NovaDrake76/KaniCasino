import { useState } from "react";
import Rarities from "../components/Rarities";
import { RotatingLines } from "react-loader-spinner";


interface PlayerPreview {
    player: {
        _id: string;
        level: number;
        profilePicture: string;
        username: string;
        fixedItem: {
            image: string;
            name: string;
            description: string;
            rarity: string;
        }
    }
}

const PlayerPreview: React.FC<PlayerPreview> = ({ player }) => {
    const [loadingImage, setLoadingImage] = useState<boolean>(true);
    return (
        <div className={`flex items-center min-w-[370px] justify-between gap-2 absolute -top-48 bg-[#281D3F]  rounded ${player.fixedItem && "border-2"} `}
            style={{
                borderColor: Rarities.find((rarity) => rarity.id.toString() == player.fixedItem?.rarity)?.color
            }}
        >
            <div className="flex items-center gap-2 p-6"><img src={player.profilePicture} className="w-20 h-20 rounded-full object-cover border-2 border-blue-500 p-1" />
                <div className="flex flex-col ">
                    <span className="font-bold text-lg">{player.username}</span>
                    <span className="font-bold text-[#56528b] ">Level {player.level}</span>
                </div></div>
            {
                player.fixedItem && (
                    <div className="flex items-center gap-2 p-6" style={{
                        backgroundImage: `radial-gradient(circle, ${Rarities.find((rarity) => rarity.id.toString() == player.fixedItem.rarity)?.color
                            } 2%, rgba(40,29,63,1) 68%)`,
                    }}>

                        <div className="flex flex-col items-center" >
                            <img src={player.fixedItem.image} className="w-24 h-24 object-contain" onLoad={() => setLoadingImage(false)} />
                            {
                                loadingImage && (
                                    <div className="absolute w-full h-full flex items-center justify-center">
                                        <RotatingLines
                                            strokeColor="grey"
                                            strokeWidth="5"
                                            animationDuration="0.75"
                                            width="50px"
                                            visible={true}
                                        />
                                    </div>
                                )
                            }

                            <span className="font-bold text-lg">{player.fixedItem.name}</span>
                        </div>
                    </div>
                )

            }
        </div>
    )
}

export default PlayerPreview;
