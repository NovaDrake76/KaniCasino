import { useState, useEffect, useRef } from "react";

interface Roulette {
  items: any;
  opened: any;
  spin: boolean;
}

const Roulette: React.FC<Roulette> = ({ items, opened, spin }) => {
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

      array[43] = opened;

      return array;
    };

    createRouletteItems();
  }, [items]);

  useEffect(() => {
    if (rouletteRef.current && spin) {
      rouletteRef.current.style.animation =
        "spin 6.31s cubic-bezier(0.1, 0, 0.2, 1)";
    } else if (rouletteRef.current) {
      rouletteRef.current.style.animation = "";
    }
  }, [spin]);
  return (
    <div className="flex max-w-4xl overflow-hidden">
      <div className="flex items-center gap-2" ref={rouletteRef}>
        {rouletteItems.map((item: any, index: number) => (
          <img
            key={index}
            src={item.image}
            alt={item.name}
            className="w-36 h-36 object-contain"
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
    </div>
  );
};

export default Roulette;
