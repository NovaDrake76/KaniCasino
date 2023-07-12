import { Link } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import UserContext from "../../UserContext";
import MainButton from "../MainButton";
import { clearTokens } from "../../services/auth/authUtils";
import { me } from "../../services/auth/auth";
import { IoMdExit } from "react-icons/io";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
// import { BiWallet } from "react-icons/bi";
import { MdOutlineSell } from "react-icons/md";
import { BsCoin } from "react-icons/bs";
import { SlPlane } from "react-icons/sl";
import { AiOutlinePlus } from "react-icons/ai";
import ClaimBonus from "./ClaimBonus";
import CashFlow from "./userFlow/CashFlow";
import DepositModal from "../DepositModal/DepositModal";


interface Navbar {
  openUserFlow: boolean;
  setOpenUserFlow: React.Dispatch<React.SetStateAction<boolean>>;
}

const Navbar: React.FC<Navbar> = ({ openUserFlow, setOpenUserFlow }) => {
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [haveBonus, setHaveBonus] = useState<boolean>(false);
  const [visibleLinksCount, setVisibleLinksCount] = useState<number>(0);
  const [openCashFlow, setOpenCashFlow] = useState<boolean>(false);
  const [openDepositModal, setOpenDepositModal] = useState<boolean>(false);
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
    calculateVisibleLinksCount();

    window.addEventListener('resize', calculateVisibleLinksCount);

    return () => {
      window.removeEventListener('resize', calculateVisibleLinksCount);
    };
  }, []);



  useEffect(() => {
    isLogged && getUserInfo();
  }, [isLogged]);

  useEffect(() => {
    if (userData?.nextBonus && Date.parse(userData?.nextBonus) <= Date.now()) {
      setHaveBonus(true);
    }
  }, [userData])

  useEffect(() => {
    if (openDepositModal) {
      setOpenCashFlow(false);
    }
  }
    , [openDepositModal])

  const links = [
    {
      name: "Vending Machine",
      path: "/vendingmachine",
      icon: <MdOutlineSell className="text-2xl" />,
    },
    {
      name: "Bandit",
      path: "/bandit",
      icon: <BsCoin className="text-2xl" />,
    },
    {
      name: "Oilrig",
      path: "/oilrig",
      icon: <SlPlane className="text-2xl" />,
    }
  ];

  const options = [
    {
      id: 'option1',
      label: 'Paypal',
      content: (
        <div>
          <p>Custom paypal deposit</p>
        </div>
      ),
    },
    {
      id: 'option2',
      label: 'SkinsBack',
      content: (
        <div>
          <p>Custom skinsback form</p>
        </div>
      ),
    },
    {
      id: 'option3',
      label: 'Option 3',
      content: (
        <div>
          <p>Option 3 content</p>
        </div>
      ),
    },
  ];



  return (
    <div className="w-full flex justify-center">
      {
        openCashFlow && <CashFlow setOpenDepositModal={setOpenDepositModal} />
      }
      {openDepositModal && (
        <DepositModal setOpenDepositModal={setOpenDepositModal} options={options} />
      )}
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
                  src="/images/logo.png"
                  alt="logo"
                  className="md:w-12 h-12 invisible md:visible"
                />
                <div className="flex flex-col justify-center invisible md:visible">
                  <div className="font-normal text-xl text-white">
                    GambleRUST
                  </div>

                  <div className="absolute">
                    <div
                      className={`flex items-center justify-center transition-all duration-300 text-[#9793ba]  text-[10px] ${isHovering === false
                        ? "opacity-0 -mt-2"
                        : "opacity-100 mt-10"
                        }`}
                    >
                      GET THE BEST ITEMS
                    </div>
                  </div>
                </div>
              </div>
            </Link>
            {
              <div className="hidden md:flex items-center gap-6 ml-8 overflow-hidden">
                {links.slice(0, visibleLinksCount).map((link, index) => (<Link
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
                <div className="flex items-center gap-2 text-green-400 font-normal text-lg hover:text-green-300 transition-all cursor-pointer" onClick={
                  () => {
                    setOpenCashFlow(!openCashFlow)
                  }
                }>

                  {/* <BiWallet className="text-2xl" /> */}
                  <img src={"/images/crude.webp"} width={30} />
                  <div className="max-w-[80px] md:max-w-none overflow-hidden truncate">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "DOL",
                    })
                      .format(userData?.walletBalance)
                      .replace("DOL", "₵R")}
                  </div>
                  <div className="flex items-center justify-center rounded-full bg-green-500 min-w-6 min-h-6 text-white p-1">
                    <AiOutlinePlus />
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
