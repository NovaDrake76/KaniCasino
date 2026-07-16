import { Link } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import Case from "../../components/Case";
import Title from "../../components/Title";

interface CaseListingProps {
  name: string;
  description?: string;
  cases: any;
  loading?: boolean;
}

// the placeholder mirrors a real card: same w-64, same h-32/md:h-64 art box, same text
// block underneath. it lives in here rather than in the page so the two states cannot
// drift apart, which is what shifted the whole page when the cases arrived.
const CaseSkeleton = () => (
  <div className="w-64 flex flex-col items-center">
    <Skeleton containerClassName="block w-full h-32 md:h-64" height="100%" borderRadius={8} />
    {/* 92px is what the real card's title and price block measures at both breakpoints
        (p-4, a text-lg line, gap-2, a base line). pinning it means the placeholder and the
        card are the same height whatever the skeleton library does with line-height */}
    <div className="h-[92px] flex flex-col gap-2 items-center justify-center">
      <Skeleton width={132} height={20} />
      <Skeleton width={72} height={16} />
    </div>
  </div>
);

const CaseListing: React.FC<CaseListingProps> = ({ name, description, cases, loading }) => {
  return (
    <div className="w-full flex flex-col gap-4 py-10 items-center" key={name}>
      <div className="flex flex-col items-center justify-center max-w-[1600px]">
        <Title title={name} />
        {description && <div className="text">{description}</div>}
        <div className="flex flex-col md:flex-row items-center justify-center w-full gap-8 md:flex-wrap">
          {loading
            ? Array(6)
                .fill(0)
                .map((_, index) => <CaseSkeleton key={index} />)
            : cases.map((item: any, index: number) => (
                <Link to={`/case/${item._id}`} key={item._id}>
                  <Case
                    key={item._id}
                    id={item._id}
                    title={item.title}
                    image={item.image}
                    price={item.price}
                    priority={index < 4}
                  />
                </Link>
              ))}
        </div>
      </div>
    </div>
  );
};

export default CaseListing;
