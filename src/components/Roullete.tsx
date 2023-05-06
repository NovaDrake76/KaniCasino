import { useState, useEffect, useRef } from "react";

interface Roulette {
  items: any;
  opened: any;
  spin: boolean;
  className?: string;
}

const Roulette: React.FC<Roulette> = ({ items, opened, spin, className }) => {
  const [rouletteItems, setRouletteItems] = useState<any[]>([]);
  const rouletteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const createRouletteItems = () => {
      let newItems = items.slice();
      while (newItems.length < 50) {
        newItems = newItems.concat(items.slice());
      }
      newItems = newItems.slice(0, 50);
      newItems = shuffle(newItems);
      setRouletteItems(newItems);
    };

    const shuffle = (array: any[]) => {
      let currentIndex = array.length,
        temporaryValue,
        randomIndex;

      while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
      }

      array[36] = opened;
      return array;
    };

    createRouletteItems();
  }, [items]);

  useEffect(() => {
    if (rouletteRef.current && spin) {
      rouletteRef.current.style.animation =
        "spin 7.1s cubic-bezier(0.1, 0, 0.2, 1)";
    } else if (rouletteRef.current) {
      rouletteRef.current.style.animation = "";
    }
  }, [spin]);
  return (
    <div className={`flex max-w-[1100px] overflow-hidden ${className}`}>
      <div className="flex items-center gap-2" ref={rouletteRef}>
        {rouletteItems.map((item: any, index: number) => (
          <img
            key={index}
            src={item.image}
            alt={item.name}
            className="w-44 h-44 object-contain"
          />
        ))}
        <style>{`
          @keyframes spin {
            from {
              transform: translateX(0%);
            }
            to {
              transform: translateX(-6200px);
            }
          }
        `}</style>
      </div>
      <div className="absolute inset-y-0 left-0 w-24 h-full bg-gradient-to-r from-[#151225] via-transparent"></div>
      <div className="absolute inset-y-0 right-0 w-24 h-full bg-gradient-to-l from-[#151225] via-transparent"></div>
    </div>
  );
};

export default Roulette;
