

import { Link } from "react-router-dom";
import { useCallback, useContext, useEffect, useState } from "react";
import UserContext from "../../../UserContext";
import MainButton from "../../MainButton";
import { clearTokens } from "../../../services/auth/authUtils";
import { me } from "../../../services/auth/auth";
import "react-loading-skeleton/dist/skeleton.css";
import { MdOutlineSell } from "react-icons/md";
import { BsCoin } from "react-icons/bs";
import { SlPlane } from "react-icons/sl";
import { GiUpgrade } from 'react-icons/gi';
import { toast } from "react-toastify";

import RightContent from "./RightContent";

interface Navbar {
  openUserFlow: boolean;
  setOpenUserFlow: React.Dispatch<React.SetStateAction<boolean>>;
  openNotifications: boolean;
  setOpenNotifications: React.Dispatch<React.SetStateAction<boolean>>;
}

const Navbar: React.FC<Navbar> = ({ setOpenUserFlow, openNotifications, setOpenNotifications }) => {
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [_visibleLinksCount, setVisibleLinksCount] = useState<number>(0);
  const { isLogged, toggleLogin, toogleUserData, userData } = useContext(UserContext);

  const calculateVisibleLinksCount = () => {
    let availableWidth = window.innerWidth;

    availableWidth = availableWidth > 500 ? availableWidth - 500 : 0;

    const count = Math.floor(availableWidth / 220);

    setVisibleLinksCount(count);
  };


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
        toogleUserData(response);
        setLoading(false);
      })
      .catch((error: any) => {
        console.log(error);
        toast.error("Please, login again");
        Logout();
        setLoading(false);
      });
  };

  useEffect(() => {
    calculateVisibleLinksCount();

    window.addEventListener('resize', calculateVisibleLinksCount);

    return () => {
      window.removeEventListener('resize', calculateVisibleLinksCount);
    };
  }, []);

  useEffect(() => {
    isLogged && getUserInfo();
  }, [isLogged]);


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
    },
    {
      name: "Upgrade",
      path: "/upgrade",
      icon: <GiUpgrade className="text-2xl" />,
    }
  ];

  const toggleUserFlow = useCallback(() => {
    setOpenUserFlow(prevState => !prevState);
  }, []);

  return (
    <div className="w-full flex justify-center">
      <nav className=" py-4 px-8 bg-[#19172D] w-[calc(100vw-2rem)] max-w-[1920px] flex justify-center notched ">
        <div className="flex items-center justify-between w-full ">
          <div className="flex">
            <Link to="/">
              <div
                className="flex items-center gap-2 "
                onMouseEnter={handleHover}
                onMouseLeave={handleHover}
              >
                <img
                  src="/images/logo.webp"
                  alt="logo"
                  className="w-12 h-12 object-contain"
                />
                <div className="hidden md:flex flex-col justify-center">
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
              <div className="hidden md:flex items-center gap-6 ml-8 overflow-hidden">
                {links.map((link, index) => (<Link
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
            <RightContent loading={loading} userData={userData} setOpenUserFlow={setOpenUserFlow}
              openNotifications={openNotifications} setOpenNotifications={setOpenNotifications}
              toogleUserData={toogleUserData} Logout={Logout} />
          ) : (
            <div className="flex items-center gap-4">
              <MainButton
                text="Sign In"
                onClick={toggleUserFlow} />
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
