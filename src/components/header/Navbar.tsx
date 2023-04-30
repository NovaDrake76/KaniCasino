import { Link } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import UserContext from "../../UserContext";
import MainButton from "../MainButton";
import { clearTokens } from "../../services/auth/authUtils";
import { me } from "../../services/auth/auth";

interface Navbar {
  openUserFlow: boolean;
  setOpenUserFlow: React.Dispatch<React.SetStateAction<boolean>>;
}

const Navbar: React.FC<Navbar> = ({ openUserFlow, setOpenUserFlow }) => {
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [data, setData] = useState<any>(null); // [1
  const { isLogged, toggleLogin } = useContext(UserContext);

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
        setData(response.data);
      })
      .catch((error: any) => {
        console.log(error);
      });
  };

  useEffect(() => {
    isLogged && getUserInfo();
  }, [isLogged]);

  return (
    <div className="w-full flex justify-center">
      <nav className=" py-4 px-8 bg-[#19172D] w-[calc(100vw-2rem)] max-w-[1920px] flex justify-center notched ">
        <div className="flex items-center justify-between w-full ">
          <Link to="/">
            <div
              className="flex items-center gap-2"
              onMouseEnter={handleHover}
              onMouseLeave={handleHover}
            >
              <img
                src="https://i.imgur.com/cVLsYjJ.png"
                alt="logo"
                className="w-12 h-12"
              />
              <div className="flex flex-col justify-center">
                <div className="font-normal text-xl text-white">KaniCasino</div>

                <div className="absolute">
                  <div
                    className={`flex items-center justify-center transition-all duration-300 text-[#9793ba]  text-[10px] ${
                      isHovering === false
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

          {isLogged === true ? (
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <div className="text-white font-normal text-lg">Dashboard</div>
              </Link>
              <div className="text-white font-normal text-lg" onClick={Logout}>
                Logout
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <MainButton
                text="Login"
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
