import { useState, useEffect, useMemo } from "react";
import Banner from "./Banner";
import CaseListing from "./CaseListing";
import CategoryBar from "./CategoryBar";
import GameListing from "./GamesListing";
import Leaderboard from "./Leaderboard";
import DiscordWidget from "./DiscordWidget";
import TopFanPromo from "./TopFanPromo";
import { groupCasesByCategory } from "./groupCases";
import {
  getCases,
  getMostOpenedCases,
  MostOpenedCase,
} from "../../services/cases/CaseServices";
import { toast } from "react-toastify";
import { BannerProps } from "./Types";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader
import i18n from "../../i18n";

// its own namespace, so a category literally called "Most Opened" cannot take the anchor
const TOP_CASES_ID = "top-cases";

const Home = () => {
  const [cases, setCases] = useState<any>();
  const [loading, setLoading] = useState<boolean>(true);
  const [mostOpened, setMostOpened] = useState<MostOpenedCase[]>([]);
  const [mostOpenedLoading, setMostOpenedLoading] = useState<boolean>(true);

  const getNewCases = async () => {
    setLoading(true);
    try {
      const response = await getCases();
      setCases(response);
    } catch {
      setCases([]);
      toast.error(i18n.t("home.errorWhileConnectingTo"));
    }
    setLoading(false);
  };

  useEffect(() => {
    getNewCases();
    // the section hides itself if nothing has been opened yet, so a failure is quiet
    getMostOpenedCases(5)
      .then(setMostOpened)
      .catch(() => setMostOpened([]))
      .finally(() => setMostOpenedLoading(false));
  }, []);

  const groups = useMemo(() => (loading ? [] : groupCasesByCategory(cases)), [cases, loading]);

  const sections = useMemo(
    () => [
      ...(mostOpened.length > 0 ? [{ id: TOP_CASES_ID, label: i18n.t("home.mostOpened") }] : []),
      ...groups.map((group) => ({ id: group.id, label: group.category })),
    ],
    [groups, mostOpened.length]
  );

  const BannerContent: BannerProps[] = [
    {
      left: {
        image: "/images/marisaBanner.webp",
        title: i18n.t("home.crashGame"),
        description: i18n.t("home.dontBurnFlyHigh"),
        link: "/crash",
      },
      right: (
        <div>
          <img src="/images/crashBannerTitle.webp" alt={i18n.t("home.upgrade")} />
        </div>
      ),
    },
    {
      left: {
        image: "/images/banners/blue-archive-plate.webp",
        title: i18n.t("home.blueArchive"),
        description: i18n.t("home.fourCasesFromKivotos"),
        link: "/case/6a5afb4e445211422b946280",
      },
      right: (
        <div>
          <img
            src="/images/banners/blue-archive-lockup.webp"
            alt={i18n.t("home.blueArchiveCases")}
          />
        </div>
      ),
    },
    {
      left: {
        image: "/images/banners/blackjack-plate.webp",
        title: i18n.t("home.blackjack"),
        description: i18n.t("home.hitStandAndBeat"),
        link: "/blackjack",
      },
      right: (
        <div>
          <img src="/images/banners/blackjack-lockup.webp" alt={i18n.t("blackjack.blackjack")} />
        </div>
      ),
    },
    {
      left: {
        image: "/images/banners/uma-musume-plate.webp",
        title: i18n.t("home.umaMusume"),
        description: i18n.t("home.fiveCasesOneWinner"),
        link: "/case/6a6029119cfaa53787df47d0",
      },
      right: (
        <div>
          <img
            src="/images/banners/uma-musume-lockup.webp"
            alt={i18n.t("home.umaMusumeCases")}
          />
        </div>
      ),
    },
    {
      left: {
        image: "/images/banners/plinko-plate.webp",
        title: i18n.t("home.plinko"),
        description: i18n.t("home.dropTheBallAnd"),
        link: "/plinko",
      },
      right: (
        <div>
          <img src="/images/banners/plinko-lockup.webp" alt={i18n.t("nav.plinko")} />
        </div>
      ),
    },
    {
      left: {
        image: "/images/banners/counter-strike-plate.webp",
        title: i18n.t("home.counterStrike"),
        description: i18n.t("home.openTheCasesCollect"),
        link: "/case/646ca0a4e9b0e208f5ddcfa6",
      },
      right: (
        <div>
          <img
            src="/images/banners/counter-strike-lockup.webp"
            alt={i18n.t("home.counterStrikeCases")}
          />
        </div>
      ),
    },
    {
      left: {
        image: "/images/homeBanner.webp",
        //if title is hide, it will hide the information component on the left side
        title: "hide",
        description: i18n.t("home.tryYourLuckNow"),
        link: "/slots",
      },
      right: (
        <div className="hidden 2xl:flex 2xl:mr-36">
          <img src="/images/KANICASINO.webp" alt={i18n.t("home.kanicasino")} />
        </div>
      ),
    },
  ];

  return (
    <div className="w-full flex justify-center">
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
        <CategoryBar sections={sections} loading={loading || mostOpenedLoading} />

        {/* the skeleton reserves the row while loading so the sections below do not jump */}
        {mostOpenedLoading ? (
          <CaseListing name={i18n.t("home.mostOpenedCases")} loading cases={[]} />
        ) : (
          mostOpened.length > 0 && (
            <CaseListing
              name={i18n.t("home.mostOpenedCases")}
              description={i18n.t("home.whatEveryoneIsOpening")}
              cases={mostOpened}
              sectionId={TOP_CASES_ID}
              eager
            />
          )
        )}

        <GameListing name={i18n.t("home.ourGames")} />

        <Leaderboard aside={<DiscordWidget />} />

        <TopFanPromo />

        {loading ? (
          <CaseListing name="Cases" loading cases={[]} />
        ) : (
          groups.map((group) => (
            <CaseListing
              key={group.category}
              name={`${group.category} Cases`}
              cases={group.cases}
              sectionId={group.id}
              collapsible
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Home;
