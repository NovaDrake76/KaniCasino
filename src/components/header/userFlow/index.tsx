import { useState } from "react";
import Login from "./Login";
import SignUp from "./SignUp";
import "./UserFlow.css";

interface UserFlowProps {}

const UserFlow: React.FC<UserFlowProps> = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);

  return (
    <div className="absolute p-8 bg-[#1C1A32] rounded w-80 shadow-sm ">
      <div
        className={`flex flex-col justify-center transition-all ${
          isLogin ? "h-[320px]" : "h-[440px]"
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
            <div className="text-blue-500">Or sign Up</div>
          ) : (
            <div className="text-blue-500">Or Login</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserFlow;
