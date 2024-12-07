import { useState, useEffect } from "react";
// import Banner from "./Banner";
// import CaseListing from "./CaseListing";
// import GameListing from "./GamesListing";
// import Leaderboard from "./Leaderboard";
import { getCases } from "../../services/cases/CaseServices";
// import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
// import { BannerProps } from "./Types";
// import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader

const Home = () => {
  const [_cases, setCases] = useState<any>();
  const [_loading, setLoading] = useState<boolean>(true);

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

  // const BannerContent: BannerProps[] = [
  //   {
  //     left: {
  //       image: "/images/marisaBanner.webp",
  //       title: "CRASH GAME",
  //       description: "Don't burn, fly high! Try your luck now!",
  //       link: "/crash",
  //     },
  //     right: (
  //       <div>
  //         <img src="/images/crashBannerTitle.webp" alt="upgrade" />
  //       </div>
  //     ),
  //   },
  //   {
  //     left: {
  //       image: "/images/paris.webp",
  //       title: "NEW UPGRADE GAME",
  //       description: "Go big or go home. Try your luck now!",
  //       link: "/upgrade",
  //     },
  //     right: null,
  //   },
  //   {
  //     left: {
  //       image: "/images/homeBanner.webp",
  //       //if title is hide, it will hide the information component on the left side
  //       title: "hide",
  //       description: "Try your luck now!",
  //       link: "/slots",
  //     },
  //     right: (
  //       <div className="hidden 2xl:flex 2xl:mr-36">
  //         <img src="/images/KANICASINO.webp" alt="kanicasino" />
  //       </div>
  //     ),
  //   },
  // ];

  return (
    <div className="w-screen flex justify-center">
      <div className=" flex-col w-full max-w-[1920px] ">
        <div className="flex flex-col md:flex-row  justify-center">
          <div className="flex ">
            <div className="flex flex-col justify-center items-center gap-4">
              <h1 className="text-5xl font-bold text-white">Hello!</h1>
              <p className="text-white max-w-xs text-center">
                <b>Kanicasino</b> is not available anyomore. It's too expensive
                to run, I'm sorry.
              </p>
              <p className="text-white">
                <b>Thank you for playing.</b> I hope you enjoyed it.
              </p>
              <div className="flex w-full justify-end">
                <p className="text-xs text-gray-500">
                  Kanicasino - Made with love by novadrake76
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <img src="/images/boo.webp" alt="kogasa fumo" />
            <p className="text-xs text-gray-500 text-center ml-40">
              source{" "}
              <a href="https://www.pixiv.net/en/artworks/119007909">here</a>
            </p>
          </div>
        </div>
        {/* <Carousel
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
 */}
      </div>
    </div>
  );
};

export default Home;
