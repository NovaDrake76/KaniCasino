import React, { useContext, useState } from "react";
// Import Google Login component (optional)
// import GoogleLogin from "react-google-login";
import { register } from "../../../services/auth/auth";
import MainButton from "../../MainButton";
import { saveTokens } from "../../../services/auth/authUtils";
import UserContext from "../../../UserContext";
// import { FaImage } from "react-icons/fa";
// import { toast } from "react-toastify";

const SignUpPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [profilePicture, _setProfilePicture] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // const [imagePreview, setImagePreview] = useState<any>(null);

  const { toggleLogin } = useContext(UserContext);

  const handleSubmit = async (e: React.FormEvent) => {
    setLoading(true);
    e.preventDefault();
    try {
      await register(email, password, nickname, profilePicture)
        .then((response) => {
          saveTokens(response.token, "");
          toggleLogin();
        })
        .catch((error) => {
          console.log(error);
          setError(
            error.response.data.message || error.response.data.errors[0].msg || "Invalid format. Please try again."
          );
        })
        .then(() => {
          setLoading(false);
        });
    } catch {
      setError("Invalid format. Please try again.");
      setLoading(false);
    }
  };

  // const handleGoogleSuccess = (response: any) => {
  //   // Handle Google sign-up logic here
  // };

  // const handleGoogleFailure = (error: any) => {
  //   // Handle Google sign-up failure here
  // };

  // const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   if (e.target.files && e.target.files[0]) {
  //     const file = e.target.files[0];
  //     const fileSizeMB = file.size / 1024 / 1024; // size in MB
  //     const validFileTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  //     const isValidFileType = validFileTypes.includes(file.type);

  //     if (fileSizeMB > 3) {
  //       toast.error('File size must be less than 3MB');
  //       return;
  //     }

  //     if (!isValidFileType) {
  //       toast.error('File type must be jpeg, jpg or png');
  //       return;
  //     }

  //     const reader = new FileReader();
  //     reader.onloadend = async () => {
  //       try {
  //         setProfilePicture(reader.result as string);
  //         setImagePreview(reader.result as string);
  //       } catch (error: any) {
  //         console.log(error);
  //         toast.error(error.message);
  //       }
  //     };
  //     reader.readAsDataURL(file);
  //   }
  // };


  return (
    <div className="flex flex-col justify-center ">
      <div className="relative ">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-indigo-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative bg-white shadow-lg sm:rounded-3xl p-10">
          <div className="max-w-md mx-auto">

            <div className="flex justify-center items-center w-full">
              {/* <label className="flex flex-col items-center justify-center w-32 h-32 rounded-full group bg-gray-200 hover:bg-gray-400 transition-all text-gray-700 hover:text-white cursor-pointer overflow-hidden">
                {imagePreview ? (
                  <img className="object-cover w-full h-full" src={imagePreview} alt="Profile preview" />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <FaImage className="w-6 h-6" />
                    <p className="lowercase text-sm tracking-wider text-center">Select a profile picture</p>
                  </div>
                )}
                <input type="file" className="hidden" onChange={handleProfilePictureChange} accept="
                image/png,
                image/jpeg,
                image/jpg" />
              </label> */}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="divide-y divide-gray-200 mt-2">
                <div className="py-2 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                  {[

                    {
                      name: "nickname",
                      type: "text",
                      required: true,
                      value: nickname,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setNickname(e.target.value),
                      placeholder: "Nickname",
                      label: "Nickname",
                    },
                    {
                      name: "email",
                      type: "email",
                      autoComplete: "email",
                      required: true,
                      value: email,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setEmail(e.target.value),
                      placeholder: "Email",
                      label: "Email",
                    },
                    {
                      name: "password",
                      type: "password",
                      autoComplete: "current-password",
                      required: true,
                      value: password,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value),
                      placeholder: "Password",
                      label: "Password",
                    }
                  ].map((input) => (
                    <div className="relative" key={input.name}>
                      <input
                        id={input.name}
                        name={input.name}
                        type={input.type}
                        autoComplete={input.autoComplete}
                        required={input.required}
                        value={input.value}
                        onChange={input.onChange}
                        className="peer h-10 w-full border-b-2 border-gray-300 text-gray-900 placeholder-transparent focus:outline-none focus:border-indigo-500 bg-white"
                        placeholder={input.placeholder}
                      />
                      <label
                        htmlFor={input.name}
                        className="absolute left-0 -top-3.5 text-gray-600 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-indigo-500"
                      >
                        {input.label}
                      </label>
                    </div>
                  ))}

                </div>
                <div className="flex flex-col ">
                  <MainButton
                    text="Sign up"
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    onClick={() => { }}
                    disabled={loading}
                    loading={loading}
                    submit
                  />

                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  {/* Uncomment to enable Google Login */}
                  {/* <GoogleLogin
                      clientId="<YOUR_GOOGLE_CLIENT_ID>"
                      buttonText="Sign up with Google"
                      onSuccess={handleGoogleSuccess}
                      onFailure={handleGoogleFailure}
                      cookiePolicy={"single_host_origin"}
                      className="w-full text-white bg-red-500 px-6 py-2 rounded-lg hover:bg-red-400"
                      /> */}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
