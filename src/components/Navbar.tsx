import { Link } from "react-router-dom";
import UserFlow from "./userFlow/index";
import { useState } from "react";

const Navbar = () => {
  const [openUserFlow, setOpenUserFlow] = useState<boolean>(false);

  return (
    <nav className=" p-4 bg-slate-400 w-screen flex justify-center">
      <div className="flex items-center justify-between w-full max-w-[1920px]">
        <Link to="/">KaniCasino</Link>
        <div
          className="font-bold text-xl text-blue-500 cursor-pointer"
          onClick={() => {
            setOpenUserFlow(!openUserFlow);
          }}
        >
          a
        </div>
        <div
          className={`absolute flex justify-end mt-16 left-[90%] transition-all duration-300 ${
            openUserFlow === false
              ? "opacity-0 -z-10 h-0 overflow-hidden -mt-36"
              : "opacity-100 z-10 "
          }`}
        >
          <UserFlow />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
