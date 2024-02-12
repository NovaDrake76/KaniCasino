import Rarities from "../../components/Rarities";
import { BasicItem } from "../../components/Types";

interface ShowPrizeProps {
    openedItem: BasicItem;
    showPrize: boolean;
    animationAux2: boolean;
}


const ShowPrize: React.FC<ShowPrizeProps> = ({ openedItem, showPrize, animationAux2 }) => {
    return (
        <div id="prize" className={`animate-fade-in flex relative`}>
            <img
                src={openedItem.image}
                alt={openedItem.name}
                className={`w-48 h-48 object-contain rounded ${showPrize ? "opacity-100" : "opacity-0"
                    }`}
            />
            {animationAux2 && (
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

export default ShowPrize;