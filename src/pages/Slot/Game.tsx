import React from 'react';
import SlotColumn from './SlotColumn';
import { SlotProps } from './Types';

interface SlotMachineProps {
    grid: string[];
    isSpinning: boolean;
    data: SlotProps | null;
    winningLines: any[];
}

const Game: React.FC<SlotMachineProps> = ({ grid, isSpinning, data, winningLines }) => {

    const renderSidebar = (index: number) => {
        return (
            <img src={"/images/sidebar.png"} alt="bottom bar" className={`h-[340px] w-2 md:w-6 -mb-4 ${index == 1 ? "scale-x-[-1]" : ""}`} />
        )
    }

    return (
        <div className="flex flex-col justify-center items-center">
            <img src={"/images/bottombar.png"} alt="bottom bar" className='w-screen md:w-[416px] scale-y-[-1]  ' />
            <div className="flex ">
                {renderSidebar(0)}
                <div className="flex bg-gray-800 w-full md:min-w-[330px] min-h-[340px]">
                    {[{
                        line: [0, 3, 6],
                    }, {
                        line: [1, 4, 7],
                    }, {
                        line: [2, 5, 8],
                    }
                    ].map(
                        (line, index) => (
                            <div className='flex relative ' key={index}>
                                <SlotColumn symbols={[grid[line.line[0]], grid[line.line[1]], grid[line.line[2]]]}
                                    isSpinning={isSpinning} position={index} winningLines={winningLines} />
                                {
                                    index !== 2 && <img src={"/images/bar.webp"} alt="bar" className={`
                                absolute right-0 overflow-hidden h-[340px] w-1 ${index == 0 ? 'scale-x-[-1]' : ''}
                                `} />
                                }
                            </ div>

                        )
                    )}
                </div>
                {renderSidebar(1)}

            </div >
            <img src={"/images/bottombar.png"} alt="bottom bar" className='w-screen md:w-[416px] z-10' />

            <div className='bg-[#AA1520] w-full  text-white text-xl font-bold p-1'>
                <div className="rounded-full border-[#ECA823] border-4 w-full p-2 flex items-center justify-center min-h-[50px]"
                    style={{
                        boxShadow: "inset 0px 0px 10px 1px #000",
                    }}
                >
                    {data?.totalPayout && data?.totalPayout > 0 && !isSpinning ? `Won ${new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "DOL",
                        minimumFractionDigits: 0,
                    })
                        .format(data?.totalPayout)
                        .replace("DOL", "K₽")
                        }` : ""}
                    {/* {message && data?.totalPayout! < 1 && !isSpinning && message} */}
                </div>
            </div>

        </div >
    );
};

export default Game;
