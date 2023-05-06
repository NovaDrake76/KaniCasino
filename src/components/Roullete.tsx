import { useState, useEffect, useRef } from "react";

interface Roulette {
  items: any;
}

const Roulette: React.FC<Roulette> = ({ items }) => {
  const [rouletteItems, setRouletteItems] = useState<any[]>([]);
  const rouletteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const createRouletteItems = () => {
      let newItems = items.slice();
      while (newItems.length < 40) {
        newItems = newItems.concat(items.slice());
      }
      newItems = newItems.slice(0, 40);
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

      return array;
    };

    createRouletteItems();
  }, [items]);

  useEffect(() => {
    if (rouletteRef.current) {
      rouletteRef.current.style.animation = "spin 5s linear infinite";
    }
  }, [rouletteItems]);

  return (
    <div
      className="flex items-center gap-2 overflow-hidden"
      ref={rouletteRef}
      style={{ animationPlayState: "running" }}
    >
      {rouletteItems.map((item: any, index: number) => (
        <div className="flex flex-col items-center gap-2 max-w-4xl" key={index}>
          <img src={item.image} alt={item.name} />
        </div>
      ))}
      <style>{`
        @keyframes spin {
          from {
            transform: translateX(0%);
          }
          to {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
};

export default Roulette;
