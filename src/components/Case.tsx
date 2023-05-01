interface CaseProps {
  id: string;
  title: string;
  image: string;
  price: number;
}

const Case: React.FC<CaseProps> = ({ id, title, image, price }) => {
  return (
    <div className="flex flex-col w-64 items-center" key={id}>
      <img src={image} alt={title} className="w-full h-64 object-cover -ml-4" />
      <div className="flex flex-col gap-2 p-4 items-center">
        <div className="font-bold text-lg ">{title}</div>
        <div className="font-medium text-md text-green-400">C₽ {price}</div>
      </div>
    </div>
  );
};

export default Case;
