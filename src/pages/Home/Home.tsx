import { useState, useEffect } from "react";
import Banner from "./Banner";
import CaseListing from "./CaseListing";
import GameListing from "./GamesListing";
import Leaderboard from "./Leaderboard";
import { getCases } from "../../services/cases/CaseServices";
import { toast } from "react-toastify";
import { BannerProps } from "./Types";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader

const Home = () => {
  const [cases, setCases] = useState<any>();
  const [loading, setLoading] = useState<boolean>(true);
  const discordURL = import.meta.env.VITE_DISCORD_INVITE;

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
        <CaseListing
          name="NEW CASES"
          loading={loading}
          cases={loading ? [] : cases.length > 6 ? cases.slice(0, 6) : cases}
        />

        {discordURL && (
          <div className="flex items-center justify-center w-full">
            <div className="w-full max-w-md pt-6 border-t border-white/20 mt-2 ">
              <p className="text-sm font-bold opacity-90 mb-3 uppercase tracking-wider text-center w-full ">
                Want to discuss the game?
              </p>
              <a
                href={discordURL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all hover:-translate-y-0.5 group w-full"
              >
                <svg
                  className="w-6 h-6 fill-current group-hover:scale-110 transition-transform"
                  viewBox="0 0 127.14 96.36"
                >
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c1.24-23.28-3.28-47.56-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
                Join our Discord
              </a>
            </div>
          </div>
        )}

        <GameListing name="Our Games" />
        <Leaderboard />
      </div>
    </div>
  );
};

export default Home;
