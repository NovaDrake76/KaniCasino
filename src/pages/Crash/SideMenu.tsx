import { AiFillCaretDown, AiFillCaretUp } from 'react-icons/ai';
import Monetary from '../../components/Monetary';
import { User } from '../../components/Types';

interface SideMenuProps {
    bet: number | null;
    setBet: any;
    cashoutAt: string;
    setCashoutAt: any;
    queued: boolean;
    multiplier: number;
    gameStarted: boolean;
    handleBet: any;
    handleCashout: any;
    isLogged: boolean;
    userGambled: boolean;
    userCashedOut: boolean;
    userData: User;
    userMultiplier: number;
    disableButton: boolean;
}

const MAX_BET = 1000000;

const SideMenu: React.FC<SideMenuProps> = ({ bet, setBet, cashoutAt, setCashoutAt, queued, multiplier, gameStarted, handleBet, handleCashout, isLogged, userGambled, userCashedOut, userData, userMultiplier, disableButton }) => {

    const target = parseFloat(cashoutAt);
    const hasTarget = Number.isFinite(target) && target >= 1.01;

    // live profit while the player's bet rides the curve, planned profit otherwise
    const inRound = userGambled && gameStarted && !userCashedOut;
    const profit = inRound
        ? (bet ?? 0) * multiplier - (bet ?? 0)
        : hasTarget
            ? (bet ?? 0) * target - (bet ?? 0)
            : 0;

    const stepTarget = (dir: 1 | -1) => {
        const base = hasTarget ? target : 2;
        const next = Math.max(1.01, Math.round((base + dir * 0.5) * 100) / 100);
        setCashoutAt(next.toFixed(2));
    };

    const invalidBet =
        !bet || bet < 1 || bet > MAX_BET || (userData && userData.walletBalance < bet);

    const renderMessage = () => {
      let message = "";

      if (!isLogged) {
        message = "Sign in to play";
      } else if (userCashedOut && gameStarted) {
        message = `Cashed Out at x${userMultiplier.toFixed(2)}`;
      } else if (userGambled) {
        message = gameStarted ? "Cash Out" : "You're in!";
      } else if (!bet || bet < 1) {
        message = "Place the bet value";
      } else if (bet > MAX_BET) {
        message = "Max bet is 1M";
      } else if (userData.walletBalance < bet) {
        message = "Not enough money";
      } else if (queued) {
        message = "Queued (click to cancel)";
      } else if (gameStarted) {
        message = "Bet (Next Round)";
      } else {
        message = "Place Bet";
      }
      return message;
    }

    const disabled =
        disableButton ||
        (isLogged && (userGambled ? !gameStarted || userCashedOut : invalidBet));

    return (
      <div className="lg:w-[340px] flex flex-col gap-2 border-r border-gray-700 py-4 px-6">
        <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
          <span>Bet Amount</span>
          <span><Monetary value={bet || 0} /></span>
        </div>
        <div className="flex">
          <input
            type="number"
            value={bet || ""}
            onKeyDown={(event) => {
              if (!/[0-9]/.test(event.key) && event.key !== "Backspace") {
                event.preventDefault();
              }
            }}
            max={MAX_BET}
            onChange={(e) => {
              const value = Number(e.target.value);
              setBet(value < 0 ? 0 : value);
            }}
            className="p-2 bg-surface-nav border border-line rounded-l rounded-r-none w-full text-sm"
          />
          <button
            onClick={() => setBet(Math.max(1, Math.floor((bet || 0) / 2)))}
            className="px-3 bg-surface-raised hover:bg-surface-hover border-y border-line text-sm font-semibold"
          >
            ½
          </button>
          <button
            onClick={() => setBet(Math.min(MAX_BET, (bet || 1) * 2))}
            className="px-3 bg-surface-raised hover:bg-surface-hover border border-line rounded-r rounded-l-none text-sm font-semibold"
          >
            2×
          </button>
        </div>

        <div className="flex items-center justify-between text-xs font-semibold text-ink-muted mt-2">
          <span>Cashout At</span>
          <span>{hasTarget ? `x${target.toFixed(2)}` : "Off"}</span>
        </div>
        <div className="flex">
          <input
            type="text"
            inputMode="decimal"
            value={cashoutAt}
            placeholder="Off"
            onChange={(e) => setCashoutAt(e.target.value.replace(/[^0-9.]/g, ""))}
            className="p-2 bg-surface-nav border border-line rounded-l rounded-r-none w-full text-sm"
          />
          <button
            onClick={() => stepTarget(-1)}
            className="px-3 bg-surface-raised hover:bg-surface-hover border-y border-line"
          >
            <AiFillCaretDown />
          </button>
          <button
            onClick={() => stepTarget(1)}
            className="px-3 bg-surface-raised hover:bg-surface-hover border border-line rounded-r rounded-l-none"
          >
            <AiFillCaretUp />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs font-semibold text-ink-muted mt-2">
          <span>Profit on Win</span>
          <span className="text-accent-gold">
            <Monetary value={profit} showFraction />
          </span>
        </div>

        <button
          onClick={userGambled && gameStarted ? handleCashout : handleBet}
          className="p-3 rounded bg-green-500 hover:bg-green-400 text-[#10241A] font-bold w-full mt-2 disabled:opacity-40 disabled:hover:bg-green-500 transition-colors"
          disabled={disabled}
        >
          {renderMessage()}
        </button>
      </div>
    );
  }

  export default SideMenu;
