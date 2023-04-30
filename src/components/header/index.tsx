import { useContext, useEffect, useState } from "react";
import UserFlow from "./userFlow";
import Navbar from "./Navbar";
import UserContext from "../../UserContext";

const Header = () => {
  const [openUserFlow, setOpenUserFlow] = useState<boolean>(false);
  const isLogged = useContext(UserContext);

  useEffect(() => {
    if (isLogged) {
      setOpenUserFlow(false);
    }
  }, [isLogged]);

  return (
    <div className="flex flex-col p-4 w-screen justify-center ">
      <div className="flex pb-2 ">a</div>
      <Navbar openUserFlow={openUserFlow} setOpenUserFlow={setOpenUserFlow} />
      <div
        className={`absolute flex justify-end mt-32 left-[95%] transition-all duration-300 ${
          openUserFlow === false
            ? "opacity-0 -z-10 h-0 overflow-hidden -mt-36"
            : "opacity-100 z-20 "
        }`}
      >
        <UserFlow />
      </div>
    </div>
  );
};

export default Header;
