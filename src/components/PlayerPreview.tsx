import { useState } from "react";
import Rarities from "../components/Rarities";
import { RotatingLines } from "react-loader-spinner";
import Avatar from "./Avatar";
import { User } from "../components/Types";

interface Player {
    player: User
}

const PlayerPreview: React.FC<Player> = ({ player }) => {
    const [loadingImage, setLoadingImage] = useState<boolean>(true);
    return (
        <div className={`flex items-center min-w-[450px] justify-between gap-2 absolute -top-48 bg-[#281D3F] rounded ${player.fixedItem && "border-2"} z-50`}
            style={{
                borderColor: Rarities.find((rarity) => rarity.id.toString() == player.fixedItem?.rarity)?.color
            }}
        >
            <div className="flex items-center gap-2 p-6">
                <div className="min-w-[96px]">
                    <Avatar image={player.profilePicture} id={player._id} size="large" level={player.level} /></div>
                <div className="flex flex-col items-start">
                    <span className="font-bold text-lg max-w-[160px] truncate">{player.username}</span>
                    <span className="font-bold text-[#56528b] ">Level {player.level}</span>
                </div>
            </div>
            {
                player.fixedItem && (
                    <div className="flex items-center gap-2 p-6 " style={{
                        backgroundImage: `radial-gradient(circle, ${Rarities.find((rarity) => rarity.id.toString() == player.fixedItem.rarity)?.color
                            } 2%, rgba(40,29,63,1) 68%)`,
                    }}>

                        <div className="flex flex-col items-center" >
                            <img src={player.fixedItem.image} className="w-24 h-24 object-contain rounded" onLoad={() => setLoadingImage(false)} />
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
