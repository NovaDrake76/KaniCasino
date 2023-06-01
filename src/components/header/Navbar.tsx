import { Link } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import UserContext from "../../UserContext";
import MainButton from "../MainButton";
import { clearTokens } from "../../services/auth/authUtils";
import { me } from "../../services/auth/auth";
import { IoMdExit } from "react-icons/io";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { BiWallet } from "react-icons/bi";
import { MdOutlineSell } from "react-icons/md";
import { BsCoin } from "react-icons/bs";
import { SlPlane } from "react-icons/sl";
import ClaimBonus from "./ClaimBonus";


interface Navbar {
  openUserFlow: boolean;
  setOpenUserFlow: React.Dispatch<React.SetStateAction<boolean>>;
}

const Navbar: React.FC<Navbar> = ({ openUserFlow, setOpenUserFlow }) => {
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { isLogged, toggleLogin, toogleUserData, userData } = useContext(UserContext);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [haveBonus, setHaveBonus] = useState<boolean>(false);

  const handleHover = () => {
    setIsHovering(!isHovering);
  };

  const Logout = () => {
    clearTokens();
    toggleLogin();
  };

  const getUserInfo = async () => {
    await me()
      .then((response: { data: any }) => {
        setData(response);
        toogleUserData(response);
        setLoading(false);
      })
      .catch((error: any) => {
        console.log(error);
        Logout();
        setLoading(false);
      });
  };


  useEffect(() => {
    isLogged && getUserInfo();
  }, [isLogged]);

  useEffect(() => {
    if (userData?.nextBonus && Date.parse(userData?.nextBonus) <= Date.now()) {
      setHaveBonus(true);
    }
  }, [userData])

  const links = [
    {
      name: "Market",
      path: "/marketplace",
      icon: <MdOutlineSell className="text-2xl" />,
    },
    {
      name: "Coin Flip",
      path: "/coinflip",
      icon: <BsCoin className="text-2xl" />,
    },
    {
      name: "Crash",
      path: "/crash",
      icon: <SlPlane className="text-2xl" />,
    }
  ];

  return (
    <div className="w-full flex justify-center">
      <nav className=" py-4 px-8 bg-[#19172D] w-[calc(100vw-2rem)] max-w-[1920px] flex justify-center notched ">
        <div className="flex items-center justify-between w-full ">
          <div className="flex">
            <Link to="/">
              <div
                className="flex items-center gap-2 w-0 md:w-auto"
                onMouseEnter={handleHover}
                onMouseLeave={handleHover}
              >
                <img
                  src="/images/logo.webp"
                  alt="logo"
                  className="md:w-12 h-12 invisible md:visible"
                />
                <div className="flex flex-col justify-center invisible md:visible">
                  <div className="font-normal text-xl text-white">
                    KaniCasino
                  </div>

                  <div className="absolute">
                    <div
                      className={`flex items-center justify-center transition-all duration-300 text-[#9793ba]  text-[10px] ${isHovering === false
                        ? "opacity-0 -mt-2"
                        : "opacity-100 mt-10"
                        }`}
                    >
                      REIMU FUMO ᗜ˰ᗜ
                    </div>
                  </div>
                </div>
              </div>
            </Link>
            {
              <div className="hidden md:flex items-center gap-6 ml-8">
                {links.map((link, index) => (
                  <Link
                    to={link.path}
                    key={index}
                    className="flex items-center gap-2 font-normal text-lg cursor-pointer "
                  >
                    <span className="text-[#625F7E] hover:text-gray-200 transition-all ">
                      {link.icon}
                    </span>
                    <span className="text-white hover:text-gray-200 transition-all ">
                      {link.name}
                    </span>
                  </Link>
                ))}
              </div>
            }
          </div>

          {isLogged === true ? (
            <div className="flex items-center gap-4">
              {
                !loading && haveBonus && (
                  //button to claim bonus 
                  <ClaimBonus setHaveBonus={setHaveBonus} setOpenUserFlow={setOpenUserFlow} toogleUserData={toogleUserData} userData={userData} />
                )

              }
              {!loading && (
                <div className="flex items-center gap-2 text-green-400 font-normal text-lg hover:text-green-300 transition-all ">
                  <BiWallet className="text-2xl" />
                  <div>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "DOL",
                    })
                      .format(userData?.walletBalance)
                      .replace("DOL", "C₽")}
                  </div>
                </div>
              )}
              {loading ? (
                <Skeleton
                  circle={true}
                  height={40}
                  width={40}
                  highlightColor="#161427"
                  baseColor="#1c1a31"
                />
              ) : (
                <Link to={`profile/${data?.id}`}>
                  {!loaded && (
                    <Skeleton
                      circle={true}
                      height={40}
                      width={40}
                      highlightColor="#161427"
                      baseColor="#1c1a31"
                    />
                  )}
                  <img
                    src={
                      data?.profilePicture
                        ? data?.profilePicture
                        : "https://i.imgur.com/uUfJSwW.png"
                    }
                    alt="avatar"
                    className={`min-w-[48px] h-12 rounded-full object-cover border-2 border-blue-500 aspect-square ${loaded ? '' : 'hidden'}`}
                    onLoad={() => setLoaded(true)}
                  />
                </Link>
              )}
              {!loading && (
                <div className="rounded-full text-xs font-semibold bg-blue-500 min-w-[20px] h-5 flex justify-center items-center -ml-7 -mb-7">
                  {userData?.level}
                </div>
              )}

              <div
                className="text-[#625F7E] font-normal text-lg cursor-pointer hover:text-gray-200 transition-all "
                onClick={Logout}
              >
                <IoMdExit className="text-2xl" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <MainButton
                text="Sign In"
                onClick={() => setOpenUserFlow(!openUserFlow)}
              />
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
