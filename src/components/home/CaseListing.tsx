import Case from "../Case";

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
        <div className="w-auto">
          <div className="text-white w-auto text-3xl font-semibold">{name}</div>

          <div
            className="w-auto mt-1 h-1 bg-[#606BC7] rounded-full shadow-lg transition-all "
            style={{
              boxShadow: "0px 0px 50px 10px #1d20b4",
            }}
          />
        </div>

        {description && <div className="text">{description}</div>}
        {
          <div className="flex items-center justiy-around mt-10">
            {cases.map((item: any) => (
              <Case
                key={item.id}
                id={item.id}
                title={item.title}
                image={item.image}
                price={item.price}
              />
            ))}
          </div>
        }
      </div>
    </div>
  );
};

export default CaseListing;
