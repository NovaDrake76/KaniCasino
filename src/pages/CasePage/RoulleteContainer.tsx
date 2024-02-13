import ShowPrize from "./ShowPrize";
import Roulette from "../../components/Roulette";
import classNames from "classnames";
import Skeleton from "react-loading-skeleton";
import { Case } from "../../components/Types";

interface RouletteContainerProps {
    loading: boolean;
    data: Case;
    started: boolean;
    showPrize: boolean;
    hasSpinned: boolean;
    animationAux: boolean;
    openedItems: any[];
    animationAux2: boolean;
    quantity: number;
}

const RouletteContainer: React.FC<RouletteContainerProps> = ({ loading, data, started, showPrize, hasSpinned, animationAux, openedItems, animationAux2, quantity }) => {

    return (
        <div className="flex">
            <img
                src="/images/arrow.svg"
                alt="left arrow"
                className="hidden lg:flex"
            />
            <div className="flex flex-col overflow-hidden max-w-[120vw] md:w-[1100px] h-72 items-center justify-center border-y-4 border-[#16152c] relative z-10">
                <div className={`absolute flex w-full items-center ${quantity < 2 ? 'flex-col' : 'flex-row'} justify-between h-[calc(100%+50px)] `}>
                    <img
                        src="/images/arrowSelector.svg"
                        alt="top arrow"
                        style={{
                            transform: quantity < 2 ? "rotate(180deg)" : "rotate(90deg)",
                            width: "94px",
                            height: "48px"
                        }}
                    />
                    <img src="/images/arrowSelector.svg" alt="bottom arrow" style={{
                        transform: quantity < 2 ? "rotate(0deg)" : "rotate(270deg)",
                        width: "94px",
                        height: "48px"
                    }} />
                </div>
                {!started && !showPrize && !hasSpinned ? (
                    loading ? (
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
                    )
                ) : started && !showPrize ? (

                    <div className={`flex gap-8`}>
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
                ) : (
                    <ShowPrize openedItems={openedItems} showPrize={showPrize} animationAux2={animationAux2} />
                )}
            </div>

            <img
                src="/images/arrow.svg"
                alt="right arrow"
                className="hidden lg:flex"
                style={{
                    transform: "rotate(180deg)",
                }}
            />
        </div>
    )

}
export default RouletteContainer;