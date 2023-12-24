import { m } from "framer-motion";
import { useState, useRef, useEffect } from "react";

interface SlotColumnProps {
    symbols: string[];
    isSpinning: boolean;
    position: number;
}

const SlotColumn: React.FC<SlotColumnProps> = ({ symbols, isSpinning, position }) => {
    const rollsize = 6272;
    const [rouletteItems, setRouletteItems] = useState<any[]>([]);
    const [translateValue, setTranslateValue] = useState<string>(`-${rollsize}px`);
    const rouletteRef = useRef<HTMLDivElement | null>(null);
    const options = ['red', 'blue', 'green', 'yin_yang', 'hakkero', 'yellow', 'wild'];

    const createRouletteItems = () => {
        let newItems = symbols.slice();
        for (let i = 0; i < 50; i++) {
            newItems.unshift(options[Math.floor(Math.random() * options.length)]);
        }
        newItems[48] = symbols[0];
        newItems[49] = symbols[1];
        newItems[50] = symbols[2];
        setRouletteItems(newItems);
    };


    useEffect(() => {
        createRouletteItems();
    }, [symbols]);


    useEffect(() => {
        if (isSpinning) {
            const randomTranslateY = -rollsize;
            setTranslateValue(`${randomTranslateY}px`);
        }
    }, [isSpinning]);


    const calculateDelay = (position: number) => {
        if (position === 0) {
            return "spin 2s cubic-bezier(0.1, 0, 0.2, 1)"
        } else if (position === 1) {
            return "spin 2.4s cubic-bezier(0.1, 0, 0.2, 1)"
        } else {
            return "spin 2.8s cubic-bezier(0.1, 0, 0.2, 1)"
        }
    };


    useEffect(() => {
        if (rouletteRef.current && isSpinning) {
            rouletteRef.current.style.animation = calculateDelay(position);
        } else if (rouletteRef.current) {
            rouletteRef.current.style.animation = "";
            rouletteRef.current.style.transform = `translateY(${translateValue})`;

        }
    }, [isSpinning, translateValue]);


    const getSymbolImage = (symbol: string) => {

        const images: { [key: string]: string } = {
            red: 'https://i.imgur.com/uR1CYH0.png',
            blue: 'https://pm1.aminoapps.com/7270/78aa14b31aa6c3118b15b785699e946557b910b7r1-512-505v2_hq.jpg',
            green: 'https://media1.tenor.com/m/_Kumf98IT9wAAAAC/cat-reads-chat-cat-eating.gif',
            yin_yang: 'https://i.imgur.com/A8JGDG3.png',
            hakkero: 'https://i.imgur.com/LLIZSbw.png',
            yellow: 'https://pm1.aminoapps.com/7270/cd0fb82f1ba0f6c3ade2e047e3bbdbb7ac651432r1-474-512v2_hq.jpg',
            wild: "https://i.imgur.com/xtWn84U.png"
        };

        return images[symbol];
    }

    return (
        <div className="max-h-[380px] overflow-hidden">
            <div ref={rouletteRef} >
                {
                    rouletteItems.map((symbol, index) => (
                        <div key={index} className={`w-32 h-32 rounded-full relative`}>
                            <img src={getSymbolImage(symbol)} alt={symbol} className="w-full h-full" />
                            {/* <div className="absolute z-10">{index}</div> */}
                        </div>
                    ))
                }
            </div>
            < style > {`
          @keyframes spin {
            from {
              transform: translateY(0%);
            }
            to {
              transform: translateY(${translateValue});
            }
          }
        `}</ style>
        </div>
    )

}

export default SlotColumn;