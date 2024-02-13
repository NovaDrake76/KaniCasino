import Rarities from "../../components/Rarities";
import { BasicItem } from "../../components/Types";

interface ShowPrizeProps {
    openedItems: BasicItem[];
    showPrize: boolean;
    animationAux2: boolean;
}


const ShowPrize: React.FC<ShowPrizeProps> = ({ openedItems, showPrize, animationAux2 }) => {
    return (
        <div className="flex items-center justify-center gap-8 w-full">
            {
                openedItems.map((openedItem, index) => {
                    return (
                        <div key={index} id="prize" className={`animate-fade-in flex relative`}>
                            <div className="flex flex-col gap-2 items-center">
                                <img
                                    src={openedItem.image}
                                    alt={openedItem.name}
                                    className={`w-48 h-48 object-contain rounded ${showPrize ? "opacity-100" : "opacity-0"} 
                                ${openedItems.length > 1 ? "notched " : ""} `}
                                    style={{
                                        background: openedItems.length > 1 && Rarities.find(
                                            (rarity) => rarity.id == openedItem.rarity
                                        )?.color || "none"
                                    }}
                                />
                                {
                                    openedItems.length > 1 && (
                                        <span>
                                            {openedItem.name}
                                        </span>
                                    )
                                }
                            </div>
                            {animationAux2 && openedItems.length == 1 && (
                                <div
                                    className={`notched h-48 w-48 transition-all animate-fade-in-left absolute left-[210px] items-center justify-center z-20 hidden md:flex`}
                                    style={{
                                        background: Rarities.find(
                                            (rarity) => rarity.id == openedItem.rarity
                                        )?.color,
                                    }}
                                >
                                    <div
                                        className={`notched h-[184px] w-[184px] transition-all bg-[#151225] z-30 flex flex-col items-center justify-center`}
                                    >
                                        <span className="text-xl font-bold color-[#e1dde9] text-center">
                                            {openedItem.name}
                                        </span>
                                        <span
                                            className="text-xl underline "
                                            style={{
                                                color: Rarities.find(
                                                    (rarity) => rarity.id == openedItem.rarity
                                                )?.color,
                                            }}
                                        >
                                            {
                                                Rarities.find(
                                                    (rarity) => rarity.id == openedItem.rarity
                                                )?.name
                                            }
                                        </span>
                                        <div
                                            style={{
                                                width: "1px",
                                                boxShadow: `0px 0px 80px 30px ${Rarities.find(
                                                    (rarity) => rarity.id == openedItem.rarity
                                                )?.color
                                                    }`,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                    )

                }
                )}
        </div>
    )

}

export default ShowPrize;