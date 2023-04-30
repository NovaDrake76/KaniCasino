import React, { useState } from "react";
import { login } from "../../services/auth/auth";
import { saveTokens } from "../../services/auth/authUtils";
import { TailSpin } from "react-loader-spinner";

interface LoginPageProps {
  onLoginSuccess: any;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingButton, setLoadingButton] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    setLoadingButton(true);
    e.preventDefault();
    try {
      const { accessToken, refreshToken } = await login(email, password);
      saveTokens(accessToken, refreshToken);
      onLoginSuccess();
      setLoadingButton(false);
    } catch (error) {
      setErrorMessage("Invalid email or password");
      setLoadingButton(false);
    }
  };

  return (
    <div className="flex items-center justify-center transition-all ">
      <div className="max-w-md w-full space-y-4">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        {errorMessage && (
          <div className="text-center text-red-500 ">{errorMessage}</div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              {[
                {
                  type: "email",
                  name: "email",
                  autoComplete: "email",
                  required: true,
                  value: email,
                  onChange: (e: {
                    target: { value: React.SetStateAction<string> };
                  }) => setEmail(e.target.value),
                  className:
                    "appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none bg-white focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm",
                  placeholder: "Email address",
                },
                {
                  type: "password",
                  name: "password",
                  autoComplete: "current-password",
                  required: true,
                  value: password,
                  onChange: (e: {
                    target: { value: React.SetStateAction<string> };
                  }) => setPassword(e.target.value),
                  className:
                    "appearance-none bg-white rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm",
                  placeholder: "Password",
                },
              ].map((props, index) => {
                return <input key={index} {...props} />;
              })}
            </div>{" "}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <a
                href="#"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Forgot your password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loadingButton}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loadingButton ? (
                <TailSpin
                  height="20"
                  width="20"
                  color="#fff"
                  ariaLabel="tail-spin-loading"
                  radius="1"
                />
              ) : (
                "Sign in"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
