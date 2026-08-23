import { Link } from "react-router-dom";
import Rarities from "../../components/Rarities";
import { BasicItem } from "../../components/Types";
import i18n from "../../i18n";

interface ShowPrizeProps {
    openedItems: BasicItem[];
    showPrize: boolean;
    animationAux2: boolean;
}

const ShowPrize: React.FC<ShowPrizeProps> = ({ openedItems, showPrize, animationAux2 }) => {
    // five prizes have to wrap onto a phone, so they are drawn small; a single one owns
    // the whole reel and is the thing the player actually came to look at
    const many = openedItems.length > 1;

    return (
        <div className="flex w-full flex-wrap items-center justify-center gap-3 overflow-y-auto px-2 md:gap-8 md:px-0">
            {
                openedItems.map((openedItem, index) => {
                    const rarity = Rarities.find((r) => r.id == openedItem.rarity);

                    return (
                        <div key={index} id="prize" className={`animate-fade-in relative flex `}>
                            <div className="flex flex-col gap-2 items-center">
                                <img
                                    src={openedItem.image}
                                    alt={openedItem.name}
                                    className={`object-contain rounded md:w-48 md:h-48 ${showPrize ? "opacity-100" : "opacity-0"} 
                                ${many ? "notched w-20 h-20" : "w-40 h-40"} `}
                                    style={{
                                        background: many && rarity?.color || "none"
                                    }}
                                />
                                {/* the card beside it carries the name on a wide screen, but it has
                                    no room to open on a phone, so the name goes under the art there */}
                                <span
                                    className={
                                        many
                                            ? "max-w-[5rem] truncate text-xs md:max-w-none md:text-base"
                                            : "text-base font-semibold md:hidden"
                                    }
                                >
                                    {openedItem.name}
                                </span>
                                {!many && (
                                    <span className="text-sm underline md:hidden" style={{ color: rarity?.color }}>
                                        {rarity?.name}
                                    </span>
                                )}
                                {openedItem.rollId && showPrize && (
                                    <Link
                                        to={`/provably-fair?roll=${openedItem.rollId}`}
                                        className="text-[10px] text-[#84819a] hover:text-white underline"
                                    >
                                        {i18n.t("casePage.provablyFair")}
                                    </Link>
                                )}
                            </div>
                            {animationAux2 && !many && (
                                <div
                                    className={`notched h-48 w-48 transition-all animate-fade-in-left absolute left-[210px] items-center justify-center z-20 hidden md:flex`}
                                    style={{
                                        background: rarity?.color,
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
                                                color: rarity?.color,
                                            }}
                                        >
                                            {rarity?.name}
                                        </span>
                                        <div
                                            style={{
                                                width: "1px",
                                                boxShadow: `0px 0px 80px 30px ${rarity?.color}`,
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
