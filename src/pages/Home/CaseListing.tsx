import { Link } from "react-router-dom";
import Case from "../../components/Case";
import Title from "../../components/Title";

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
    <div className="w-full flex flex-col gap-4 py-10 items-center" key={name}>
      <div className="flex flex-col items-center justify-center max-w-[1600px]">
        <Title title={name} />
        {description && <div className="text">{description}</div>}
        {
          <div className="flex flex-col md:flex-row items-center  justiy-center w-full gap-8 md:flex-wrap">
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
