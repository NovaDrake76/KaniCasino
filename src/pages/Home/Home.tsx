import { useState, useEffect } from "react";
import Banner from "./Banner";
import CaseListing from "./CaseListing";
import GameListing from "./GamesListing";
import Leaderboard from "./Leaderboard";
import { getCases } from "../../services/cases/CaseServices";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { BannerProps } from "./Types";
import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader


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

  const BannerContent: BannerProps[] = [
    {
      left: {
        image: "/images/marisaBanner.webp",
        title: "CRASH GAME",
        description: "Don't burn, fly high! Try your luck now!",
        link: "/crash",
      },
      right: <div><img src="/images/crashBannerTitle.webp" alt="upgrade" /></div>,
    },
    {
      left: {
        image: "/images/paris.webp",
        title: "NEW UPGRADE GAME",
        description: "Go big or go home. Try your luck now!",
        link: "/upgrade",
      },
      right: null,
    }, {
      left: {
        image: "/images/homeBanner.webp",
        //if title is hide, it will hide the information component on the left side
        title: "hide",
        description: "Try your luck now!",
        link: "/slots",
      },
      right: <div className="hidden 2xl:flex 2xl:mr-36"><img src="/images/KANICASINO.webp" alt="kanicasino" /></div>,
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
            BannerContent.map((_item, index) => (
              <Banner key={index} left={_item.left} right={_item.right} />
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
          cases={cases.length > 6 ? cases.slice(0, 6) : cases}
          />
        )}
        <GameListing name="Our Games" />
        <Leaderboard />

      </div>
    </div>
  );
};

export default Home;
