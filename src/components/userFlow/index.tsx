import { useState } from "react";
import Login from "./Login";
import SignUp from "./SignUp";
import axios from "axios";
import "./UserFlow.css";

interface UserFlowProps {}

const UserFlow: React.FC<UserFlowProps> = () => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const onLoginSuccess = async (response: {
    profileObj: { email: any };
    tokenId: any;
  }) => {
    try {
      // Get the email and Google ID Token from the Google user object
      const email = response.profileObj.email;
      const tokenId = response.tokenId;

      // Send a request to the /login endpoint with the email and Google ID Token
      const result = await axios.post(`${"localhost:5000"}users/login`, {
        email,
        tokenId,
      });

      // Handle the result of the login request (e.g., store JWT, navigate to the main page, etc.)
      if (result.data && result.data.token) {
        // Store the JWT token in local storage or other preferred storage
        localStorage.setItem("authToken", result.data.token);

        // Navigate to the main page or perform other post-login actions
      }
    } catch (error) {
      console.error("Login error:", error);
      // Handle the login error (e.g., show an error message, retry, etc.)
    }
  };

  return (
    <div className="absolute p-8 bg-gray-50 rounded w-80 shadow-sm ">
      <div
        className={`flex flex-col justify-center transition-all ${
          isLogin ? "h-[320px]" : "h-[440px]"
        }`}
      >
        {isLogin ? <Login onLoginSuccess={onLoginSuccess} /> : <SignUp />}
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
