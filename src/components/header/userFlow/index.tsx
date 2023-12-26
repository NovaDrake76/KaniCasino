import { useState } from "react";
import Login from "./Login";
import SignUp from "./SignUp";
import "./UserFlow.css";

const UserFlow: React.FC = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);

  return (
    <div className="absolute p-8 bg-[#1C1A32] rounded w-80 shadow-sm ">
      <div
        className={`flex flex-col justify-center transition-all ${isLogin ? "h-[340px]" : "h-[380px]"
          }`}
      >
        {isLogin ? <Login /> : <SignUp />}
        <div
          className="flex text-black justify-end cursor-pointer mt-1"
          onClick={() => {
            setIsLogin(!isLogin);
          }}
        >
          {isLogin ? (
            <div className="text-blue-500 underline">Or create an account</div>
          ) : (
            <div className="text-blue-500 underline">Or Login</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserFlow;
