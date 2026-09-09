import { AiOutlineArrowRight } from "react-icons/ai";
import { Link } from "react-router-dom";
import { BannerProps } from "./Types";
import i18n from "../../i18n";


const Banner: React.FC<BannerProps> = ({ left, right }) => {
  return (
    <div
      className={`w-full max-w-[1920px] h-[460px]  bg-no-repeat hidden md:flex bg-cover bg-center`}
      style={{ backgroundImage: `url(${left.image})` }}
    >
      <div className="flex items-center justify-center w-full ">
        <div className="flex max-w-7xl w-full items-center justify-between">
          {
            left.title !== "hide" ? (
              <div className="w-72 min-h-[14rem] notched bg-[#CF3464] flex p-[2px]">
                <div className="w-full notched bg-[#111121] hover:bg-opacity-95 transition-all flex flex-col items-center justify-center px-6 py-5">
                  <div className="flex flex-col ">
                    <span className="text-lg font-semibold text-white text-start">
                      {left?.title}
                    </span>
                    <span className="text-base text-[#dfddef] text-left ">
                      {left?.description}
                    </span>
                    {left.cta ? (
                      <a
                        href={left.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 self-start bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
                      >
                        {left.cta}
                      </a>
                    ) : (
                      <Link to={left?.link}>
                        <div className="flex items-center gap-2 mt-2 text-[#70699b] hover:text-[#CF3464] transition-all ">
                          {i18n.t("home.goToPage")} <AiOutlineArrowRight />
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ) : null
          }
          <div className="flex justify-end w-full">
            {
              right
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default Banner;