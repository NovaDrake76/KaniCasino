import { useContext, useRef, useState } from "react";
import Login from "./Login";
import SignUp from "./SignUp";
import "./UserFlow.css";
import UserContext from "../../../UserContext";
import useOutsideClick from "../../../hooks/useOutsideClick";
import Modal from "../../Modal";

const UserFlow: React.FC = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const { toogleUserFlow } = useContext(UserContext);
  const loginRef = useRef(null);

  useOutsideClick(loginRef, () => {
    toogleUserFlow(false);
  }
  );

  return (
    <div ref={loginRef} >
      <Modal open={true} setOpen={toogleUserFlow} width={"400px"}>
        <div className="flex items-center justify-center p-8" >
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
      </Modal>

    </div>
  );
};

export default UserFlow;
