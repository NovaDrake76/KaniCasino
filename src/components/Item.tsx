interface itemProps {
  item: {
    name: string;
    image: string;
    rarity: number;
  };
}

const Item: React.FC<itemProps> = ({ item }) => {
  const rarities = [
    {
      id: 1,
      name: "Common",
      color: "#4B69FF",
    },
    {
      id: 2,
      name: "Rare",
      color: "#8847FF",
    },
    {
      id: 3,
      name: "Epic",
      color: "#D32CE6",
    },
    {
      id: 4,
      name: "Ultra Rare",
      color: "#EB4B4B",
    },
    {
      id: 5,
      name: "Unique",
      color: "#FFFF6E",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center bg-[#212031] rounded">
      <div className="overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="w-52 h-52 hover:scale-105 transition-all"
        />
        <div
          className="w-auto"
          style={{
            boxShadow: `0px 0px 120px 80px ${
              rarities.find((rarity) => rarity.id == item.rarity)?.color
            }`,
          }}
        />
      </div>

      <p className="text-xl py-2">{item.name}</p>
    </div>
  );
};

export default Item;
