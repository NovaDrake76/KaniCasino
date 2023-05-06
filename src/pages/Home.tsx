import { useState, useEffect } from "react";
import Banner from "../components/home/Banner";
import CaseListing from "../components/home/CaseListing";
import { getCases } from "../services/cases/CaseServices";

interface BannerProps {
  left: {
    image: string;
    title: string;
    description: string;
    link: string;
  };
}

const Home = () => {
  const [cases, setCases] = useState<any>();
  const [loading, setLoading] = useState<boolean>(true);

  const getNewCases = async () => {
    setLoading(true);
    getCases()
      .then((response) => {
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

  const leftContent: BannerProps["left"] = {
    image: "/images/HomeBanner.webp",
    title: "NEW MAJOR CASE",
    description: "Check out our new case for Paris 2023 Major!",
    link: "/case/6454fc0436a60f47a8aa9838",
  };

  return (
    <div className="w-screen flex justify-center">
      <div className="flex flex-col max-w-[1920px]">
        <Banner left={leftContent} />
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
