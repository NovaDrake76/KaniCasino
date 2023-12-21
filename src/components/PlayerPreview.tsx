import { useState } from "react";
import Rarities from "../components/Rarities";
import { RotatingLines } from "react-loader-spinner";
import Avatar from "./Avatar";


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
        <div className={`flex items-center min-w-[400px] justify-between gap-2 absolute -top-48 bg-[#281D3F] rounded ${player.fixedItem && "border-2"} `}
            style={{
                borderColor: Rarities.find((rarity) => rarity.id.toString() == player.fixedItem?.rarity)?.color
            }}
        >
            <div className="flex items-center gap-2 p-6">
                <Avatar image={player.profilePicture} id={player._id} size="large" level={player.level} />
                <div className="flex flex-col ">
                    <span className="font-bold text-lg">{player.username}</span>
                    <span className="font-bold text-[#56528b] ">Level {player.level}</span>
                </div>
            </div>
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


                            <span className="text-base py-2 font-semibold"
                                style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }}>{player.fixedItem.name}</span>
                        </div>
                    </div>
                )

            }
        </div>
    )
}

export default PlayerPreview;
