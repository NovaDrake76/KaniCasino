import { useState, useEffect } from "react";
import Banner from "../components/home/Banner";
import CaseListing from "../components/home/CaseListing";
// import GameListing from "../components/home/GamesListing";
import { getCases } from "../services/cases/CaseServices";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader
import { Carousel } from 'react-responsive-carousel';


const Home = () => {
  const [cases, setCases] = useState<any>();
  const [loading, setLoading] = useState<boolean>(true);

  const getNewCases = async () => {
    setLoading(true);
    try {
      const response = await getCases()
      setCases(response);
    } catch {
      setCases([])
      toast.error("Error while connecting to the server")
    }
    setLoading(false);

  };

  useEffect(() => {
    getNewCases();
  }, []);

  const leftContent = [{
    image: "/images/paris.webp",
    title: "FIRST DEPOSIT BONUS",
    description: "Check out our new cases for the best skins!",
    link: "/case/649d9d0630beb3dc0db1dc2e",
  }, {
    image: "https://images.squarespace-cdn.com/content/v1/602d246245658135031e4b2a/1618237559728-PL0IR64SPZ3WQMCOWTE7/Banner+beta+end+1.png?format=1000w",
    title: "UPGRADE YOUR GAME",
    description: "Check out our new cases for the best skins!",
    link: "/case/649d9d0630beb3dc0db1dc2e",
  }, {
    image: "/images/summer.webp",
    title: "USE YOUR BONUS",
    description: "Check out our new cases for the best skins!",
    link: "/case/649d9d0630beb3dc0db1dc2e",
  },
  {
    image: "https://mmos.com/wp-content/uploads/2021/08/rust-going-deep-underwater-lab-banner.jpg",
    title: "COMPLETE YOUR COLLECTION",
    description: "Check out our new cases for the best skins!",
    link: "/case/649d9d0630beb3dc0db1dc2e",
  }
  ]


  return (
    <div className="w-screen flex justify-center">
      <div className=" flex-col w-full max-w-[1920px] ">
        <Carousel
          autoPlay={true}
          infiniteLoop={true}
          showThumbs={false}
          showStatus={false}
          showIndicators={false}
          showArrows={false}
          interval={7000}
          stopOnHover={false}

        >
          {
            leftContent.map((_item, index) => (
              <Banner left={leftContent[index]} />
            ))

          }

        </Carousel>
        {loading ? (
          <div className="flex items-center justify-center w-full mt-[164px]">
            <div className="flex justiy-center gap-8 max-w-[1600px] flex-col md:flex-row">
              {Array(4)
                .fill(0)
                .map((e, index) => (
                  <div key={index}>
                    <Skeleton
                      width={256}
                      height={348}
                      highlightColor="#161427"
                      baseColor="#1c1a31"
                      key={e + index}
                    />
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <CaseListing
            name="NEW CASES"
            cases={cases.length > 5 ? cases.slice(0, 5) : cases}
          />
        )}
        {/* <GameListing name="TRY YOUR LUCK" /> */}
      </div>
    </div>
  );
};

export default Home;
