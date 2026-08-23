import ShowPrize from "./ShowPrize";
import Roulette from "../../components/Roulette";
import classNames from "classnames";
import Skeleton from "react-loading-skeleton";
import { Case } from "../../components/Types";
import i18n from "../../i18n";

interface RouletteContainerProps {
    loading: boolean;
    data: Case;
    started: boolean;
    showPrize: boolean;
    animationAux: boolean;
    openedItems: any[];
    animationAux2: boolean;
    quantity: number;
}

const RouletteContainer: React.FC<RouletteContainerProps> = ({ loading, data, started, showPrize, animationAux, openedItems, animationAux2, quantity }) => {

    return (
        <div className="flex w-full justify-center">
            <img
                src="/images/reelEdge.svg"
                alt={i18n.t("casePage.leftArrow")}
                className="hidden lg:flex"
            />
            <div className="flex flex-col overflow-hidden w-full md:w-[1100px] h-72 items-center justify-center border-y-4 border-[#16152c] relative z-10">
                {/* the markers are the only thing saying which slot wins, so they sit above the
                    reels: on a phone the strip fills the width and used to bury them */}
                <div className={`absolute z-20 pointer-events-none flex w-full items-center ${quantity < 2 ? 'flex-col' : 'flex-row'} justify-between h-[calc(100%+32px)] md:h-[calc(100%+50px)] `}>
                    <img
                        src="/images/reelMarker.svg"
                        alt={i18n.t("casePage.topArrow")}
                        className="w-16 h-8 drop-shadow-[0_0_3px_rgba(0,0,0,0.9)] md:w-[94px] md:h-12 md:drop-shadow-none"
                        style={{ transform: quantity < 2 ? "rotate(180deg)" : "rotate(90deg)" }}
                    />
                    <img
                        src="/images/reelMarker.svg"
                        alt={i18n.t("casePage.bottomArrow")}
                        className="w-16 h-8 drop-shadow-[0_0_3px_rgba(0,0,0,0.9)] md:w-[94px] md:h-12 md:drop-shadow-none"
                        style={{ transform: quantity < 2 ? "rotate(0deg)" : "rotate(270deg)" }}
                    />
                </div>
                {/* prize renders only once showPrize is set; falling through to it during
                    the pre-spin delay used to flash the multi-open result names early */}
                {showPrize ? (
                    <ShowPrize openedItems={openedItems} showPrize={showPrize} animationAux2={animationAux2} />
                ) : started && openedItems.length > 0 ? (

                    <div className="flex gap-2 md:gap-8">
                        {
                            [...Array(quantity)].map((_, index) => (
                                <Roulette
                                    items={data.items}
                                    openedItem={openedItems[index]}
                                    spin={started}
                                    className={classNames({ "animate-fade-in-down": started })}
                                    key={index}
                                    direction={quantity < 2 ? "horizontal" : "vertical"}
                                />
                            ))

                        }
                    </div>
                ) : loading ? (
                    <Skeleton width={208} height={208} />
                ) : (
                    <img
                        src={data.image}
                        alt={data.title}
                        className={classNames(
                            "w-52 h-52 object-cover z-10",
                            { "animate-bounce-up-fade": animationAux },
                            "transition duration-500"
                        )}
                        id="caseImage"
                    />
                )}
            </div>

            <img
                src="/images/reelEdge.svg"
                alt={i18n.t("casePage.rightArrow")}
                className="hidden lg:flex"
                style={{
                    transform: "rotate(180deg)",
                }}
            />
        </div>
    )

}
export default RouletteContainer;