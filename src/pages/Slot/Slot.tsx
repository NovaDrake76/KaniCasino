import React, { useEffect, useState } from 'react';
import Game from './Game';
import { spinSlots } from '../../services/games/GamesServices';
import { toast } from 'react-toastify';

const renderPlaceholder = () => {
    const options = ['red', 'blue', 'green', 'yin_yang', 'hakkero', 'yellow', 'wild'];
    return Array.from({ length: 9 }, () => options[Math.floor(Math.random() * options.length)]);
};

const Slots = () => {
    const [grid, setGrid] = useState<string[]>(renderPlaceholder());
    const [betAmount, setBetAmount] = useState<number>(10);
    const [isSpinning, setIsSpinning] = useState<boolean>(false);

    const handleSpin = async () => {
        try {
            const response = await spinSlots(betAmount);
            setGrid(response.gridState);
            setIsSpinning(true);

            setTimeout(() => {
                setIsSpinning(false);
            }, 3000);
        } catch (e: any) {
            console.error(e.response?.data.message || "Error spinning slots");
            toast.error(e.response?.data.message || "Error spinning slots");
            setIsSpinning(false);
        }
    };

    const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBetAmount(Number(e.target.value));
    };

    return (
        <div className=" mx-auto p-4">
            <Game grid={grid} isSpinning={isSpinning} />
            <div className="flex justify-center mt-4">
                <input
                    type="number"
                    min="1"
                    value={betAmount}
                    onChange={handleBetAmountChange}
                    className="text-center mr-2 p-2 border rounded"
                />
                <button onClick={handleSpin} disabled={isSpinning} className="bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">
                    Spin
                </button>
            </div>
            <div className="mt-4 text-center">
                <p className="text-lg">Bet Amount: {betAmount} fodase essa porra</p>
            </div>
        </div>
    );
};

export default Slots;
