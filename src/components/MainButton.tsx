import { TailSpin } from "react-loader-spinner";

interface MainButton {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  submit?: boolean;
}

const MainButton: React.FC<MainButton> = ({
  text,
  onClick,
  disabled,
  loading,
  submit,
}) => {
  return (
    <button
      className={`flex items-center justify-center w-full h-10 bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md text-white font-medium md:text-lg ${disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
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
        text
      )}
    </button>
  );
};

export default MainButton;
