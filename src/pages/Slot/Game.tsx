import React from 'react';

interface SlotMachineProps {
    grid: string[];
    isSpinning: boolean;
}

const Game: React.FC<SlotMachineProps> = ({ grid, isSpinning }) => {
    const getSymbolImage = (symbol: string) => {

        const images: { [key: string]: string } = {
            red: 'https://i.imgur.com/uR1CYH0.png',
            blue: 'https://pm1.aminoapps.com/7270/78aa14b31aa6c3118b15b785699e946557b910b7r1-512-505v2_hq.jpg',
            green: '/path/to/green.png',
            yin_yang: 'https://www.dlf.pt/dfpng/middlepng/238-2384468_log-in-sign-up-upload-clipart-reimu-yin.png',
            hakkero: 'https://i.imgur.com/LLIZSbw.png',
            yellow: 'https://pm1.aminoapps.com/7270/cd0fb82f1ba0f6c3ade2e047e3bbdbb7ac651432r1-474-512v2_hq.jpg',
            wild: "https://i.imgur.com/IgorFb9.png"
        };

        return images[symbol];
    };

    return (
        <div className="flex justify-center items-center">
            <div className="grid grid-cols-3 gap-2 p-4 bg-gray-800 rounded-lg">
                {grid.map((symbol, index) => (
                    <div key={index} className={`h-24 w-24 flex justify-center items-center rounded-lg ${isSpinning ? 'animate-spin' : ''}`}>
                        <img src={getSymbolImage(symbol)} alt={symbol} className="max-h-full max-w-full" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Game;
