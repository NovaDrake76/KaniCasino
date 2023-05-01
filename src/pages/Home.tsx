import { useState, useEffect } from "react";
import Banner from "../components/Banner";
import CaseListing from "../components/home/CaseListing";
import { getCases } from "../services/cases/CaseServices";

const Home = () => {
  const [cases, setCases] = useState<any>();
  const [loading, setLoading] = useState<boolean>(true);

  const getNewCases = async () => {
    setLoading(true);
    getCases()
      .then((response) => {
        console.log(response);
        setCases(response);
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getNewCases();
  }, []);

  return (
    <div className="w-screen flex justify-center">
      <div className="flex flex-col max-w-[1920px]">
        <Banner image={"/images/HomeBanner.webp"} />
        {loading ? (
          "Loading..."
        ) : (
          <CaseListing
            name="NEW CASES"
            cases={cases.length > 5 ? cases.slice(0, 5) : cases}
          />
        )}
      </div>
    </div>
  );
};

export default Home;
