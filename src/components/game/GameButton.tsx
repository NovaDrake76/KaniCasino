interface GameButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "cashout" | "danger" | "secondary";
}

// the four actions a game can offer, so play is green everywhere and cashing out is always gold.
// hover is gated on :enabled, otherwise a disabled button still lights up under the cursor.
const variants = {
  primary: "bg-green-500 enabled:hover:bg-green-400 text-[#10241A]",
  cashout: "bg-accent-gold enabled:hover:brightness-110 text-[#2a2100]",
  danger: "bg-red-500 enabled:hover:bg-red-400 text-white",
  secondary: "bg-accent enabled:hover:bg-accent-light text-white",
};

const GameButton: React.FC<GameButtonProps> = ({ children, onClick, disabled, variant = "primary" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full min-h-[46px] px-3 rounded font-bold transition-colors disabled:opacity-40 ${variants[variant]}`}
  >
    {children}
  </button>
);

export default GameButton;
