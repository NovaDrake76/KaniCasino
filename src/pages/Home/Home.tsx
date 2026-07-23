import { useState, useEffect } from "react";
import Banner from "./Banner";
import CaseListing from "./CaseListing";
import GameListing from "./GamesListing";
import Leaderboard from "./Leaderboard";
import DiscordCta from "./DiscordCta";
import { groupCasesByCategory } from "./groupCases";
import { getCases, getMostOpenedCases, MostOpenedCase } from "../../services/cases/CaseServices";
import { toast } from "react-toastify";
import { BannerProps } from "./Types";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader

const Home = () => {
  const [cases, setCases] = useState<any>();
  const [loading, setLoading] = useState<boolean>(true);
  const [mostOpened, setMostOpened] = useState<MostOpenedCase[]>([]);

  const getNewCases = async () => {
    setLoading(true);
    try {
      const response = await getCases();
      setCases(response);
    } catch {
      setCases([]);
      toast.error("Error while connecting to the server");
    }
    setLoading(false);
  };

  useEffect(() => {
    getNewCases();
    // the section hides itself if nothing has been opened yet, so a failure is quiet
    getMostOpenedCases(5)
      .then(setMostOpened)
      .catch(() => setMostOpened([]));
  }, []);

  const BannerContent: BannerProps[] = [
    {
      left: {
        image: "/images/marisaBanner.webp",
        title: "CRASH GAME",
        description: "Don't burn, fly high! Try your luck now!",
        link: "/crash",
      },
      right: (
        <div>
          <img src="/images/crashBannerTitle.webp" alt="upgrade" />
        </div>
      ),
    },
    {
      left: {
        image: "/images/paris.webp",
        title: "NEW UPGRADE GAME",
        description: "Go big or go home. Try your luck now!",
        link: "/upgrade",
      },
      right: null,
    },
    {
      left: {
        image: "/images/homeBanner.webp",
        //if title is hide, it will hide the information component on the left side
        title: "hide",
        description: "Try your luck now!",
        link: "/slots",
      },
      right: (
        <div className="hidden 2xl:flex 2xl:mr-36">
          <img src="/images/KANICASINO.webp" alt="kanicasino" />
        </div>
      ),
    },
  ];

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
          {BannerContent.map((_item, index) => (
            <Banner key={index} left={_item.left} right={_item.right} />
          ))}
        </Carousel>
        {mostOpened.length > 0 && (
          <CaseListing
            name="Most Opened Cases"
            description="What everyone is opening right now."
            cases={mostOpened}
            eager
          />
        )}

        <GameListing name="Our Games" />

        <DiscordCta />

        <Leaderboard />

        {loading ? (
          <CaseListing name="Cases" loading cases={[]} />
        ) : (
          groupCasesByCategory(cases).map((group) => (
            <CaseListing
              key={group.category}
              name={`${group.category} Cases`}
              cases={group.cases}
              collapsible
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Home;
