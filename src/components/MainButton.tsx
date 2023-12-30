import { TailSpin } from "react-loader-spinner";

interface MainButton {
  text: string | JSX.Element;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  submit?: boolean;
  icon?: any;
  iconPosition?: "left" | "right";
  type?: "button" | "danger" | "success" | "warning" | "info" | "dark";
  pulse?: boolean;
}

const MainButton: React.FC<MainButton> = ({
  text,
  onClick,
  disabled,
  loading,
  submit,
  icon,
  iconPosition = "left",
  type = "button",
  pulse,

}) => {

  const colorClasses = {
    button: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
    danger: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    success: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
    warning: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
    info: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    dark: "bg-gray-800 hover:bg-gray-900 focus:ring-gray-500",
  };

  const pulseClass = pulse ? "animate-bounce " : "";

  return (
    <button
      className={`flex items-center justify-center w-full h-10 ${colorClasses[type]} 
      focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-md
      text-white font-medium md:text-lg ${disabled ? "opacity-50 cursor-not-allowed" : pulseClass} `}
      onClick={onClick}
      disabled={disabled}
      type={submit ? "submit" : "button"}
    >
      {loading ? (
        <TailSpin
          height="20"
          width="20"
          color="#fff"
          ariaLabel="tail-spin-loading"
          radius="1"
        />
      ) : (
        <>
          {icon && iconPosition === "left" && <span className="mr-2">{icon}</span>}
          {text}
          {icon && iconPosition === "right" && <span className="ml-2">{icon}</span>}
        </>
      )}
    </button>
  );
};

export default MainButton;
