import { Link } from "react-router-dom";
import Case from "../Case";
import Title from "../Title";

interface CaseListingProps {
  name: string;
  description?: string;
  cases: any;
}

const CaseListing: React.FC<CaseListingProps> = ({
  name,
  description,
  cases,
}) => {
  return (
    <div className="w-full flex flex-col gap-4 py-10" key={name}>
      <div className="flex flex-col items-center justify-center">
        <Title title={name} />
        {description && <div className="text">{description}</div>}
        {
          <div className="flex items-center justiy-around ">
            {cases.map((item: any) => (
              <Link to={`/case/${item._id}`} key={item._id}>
                <Case
                  key={item._id}
                  id={item._id}
                  title={item.title}
                  image={item.image}
                  price={item.price}
                />
              </Link>
            ))}
          </div>
        }
      </div>
    </div>
  );
};

export default CaseListing;
