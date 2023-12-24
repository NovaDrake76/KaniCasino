import React from 'react';
import SlotColumn from './SlotColumn';

interface SlotMachineProps {
    grid: string[];
    isSpinning: boolean;
}

const Game: React.FC<SlotMachineProps> = ({ grid, isSpinning }) => {

    return (
        <div className="flex justify-center items-center">
            <div className="flex gap-2 p-4 bg-gray-800 rounded-lg">
                <SlotColumn symbols={[grid[0], grid[3], grid[6]]} isSpinning={isSpinning} position={0} />
                <SlotColumn symbols={[grid[1], grid[4], grid[7]]} isSpinning={isSpinning} position={1} />
                <SlotColumn symbols={[grid[2], grid[5], grid[8]]} isSpinning={isSpinning} position={2} />
            </div>

        </div>
    );
};

export default Game;
