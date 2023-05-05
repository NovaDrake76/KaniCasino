import { useState } from "react";

interface CaseProps {
  id: string;
  title: string;
  image: string;
  price: number;
}

const Case: React.FC<CaseProps> = ({ id, title, image, price }) => {
  const [hover, setHover] = useState<boolean>(false);
  return (
    <div
      className="flex flex-col w-64 items-center rounded transition-all"
      key={id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        boxShadow: hover ? `0px 0px 20px 10px #3D2A5B` : "none",
      }}
    >
      <img src={image} alt={title} className="w-full h-64 object-cover -ml-4" />
      <div className="flex flex-col gap-2 p-4 items-center">
        <div className="font-bold text-lg ">{title}</div>
        <div className="font-medium text-md text-green-400">C₽ {price}</div>
      </div>
    </div>
  );
};

export default Case;
