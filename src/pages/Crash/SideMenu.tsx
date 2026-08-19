import { AiFillCaretDown, AiFillCaretUp } from 'react-icons/ai';
import Monetary from '../../components/Monetary';
import GameButton from '../../components/game/GameButton';
import BetAmount from '../../components/game/BetAmount';
import { User } from '../../components/Types';
import i18n from "../../i18n";

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
        // from "off", either arrow lands on the classic default first
        if (!hasTarget) return setCashoutAt("2.00");
        const next = Math.max(1.01, Math.round((target + dir * 0.5) * 100) / 100);
        setCashoutAt(next.toFixed(2));
    };

    const invalidBet =
        !bet || bet < 1 || bet > MAX_BET || (userData && userData.walletBalance < bet);

    const renderMessage = () => {
      let message = "";

      if (!isLogged) {
        message = i18n.t("upgrade.signInToPlay");
      } else if (userCashedOut && gameStarted) {
        message = i18n.t("crash.cashedOutAt", { multiplier: userMultiplier.toFixed(2) });
      } else if (userGambled) {
        message = gameStarted ? i18n.t("common.cashOut") : "You're in!";
      } else if (!bet || bet < 1) {
        message = i18n.t("coin.placeTheBetValue");
      } else if (bet > MAX_BET) {
        message = i18n.t("coin.maxBetIs1m");
      } else if (userData.walletBalance < bet) {
        message = i18n.t("coin.notEnoughMoney");
      } else if (queued) {
        message = i18n.t("crash.queuedClickToCancel");
      } else if (gameStarted) {
        message = i18n.t("crash.betNextRound");
      } else {
        message = i18n.t("crash.placeBet");
      }
      return message;
    }

    const disabled =
        disableButton ||
        (isLogged && (userGambled ? !gameStarted || userCashedOut : invalidBet));

    return (
      <div className="lg:w-[340px] flex flex-col gap-2 border-r border-gray-700 py-4 px-6">
        <BetAmount
          value={bet === null ? "" : String(bet)}
          onChange={(value) => setBet(value === "" ? null : Math.min(MAX_BET, Number(value)))}
          onHalve={() => setBet(Math.max(1, Math.floor((bet || 0) / 2)))}
          onDouble={() => setBet(Math.min(MAX_BET, (bet || 1) * 2))}
          betValue={bet || 0}
        />

        <div className="flex items-center justify-between text-xs font-semibold text-ink-muted mt-2">
          <span>{i18n.t("crash.cashoutAt")}</span>
          <span>{hasTarget ? `x${target.toFixed(2)}` : "Off"}</span>
        </div>
        <div className="flex">
          <input
            type="text"
            inputMode="decimal"
            value={cashoutAt}
            placeholder={i18n.t("crash.off")}
            onChange={(e) => setCashoutAt(e.target.value.replace(/[^0-9.]/g, ""))}
            className="p-2 bg-surface-nav border border-line rounded-l rounded-r-none w-full text-sm"
          />
          <button
            onClick={() => stepTarget(-1)}
            className="px-3 bg-surface-raised hover:bg-surface-hover border-y border-line rounded-none"
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
          <span>{i18n.t("crash.profitOnWin")}</span>
          <span className="text-accent-gold">
            <Monetary value={profit} showFraction />
          </span>
        </div>

        <div className="mt-2">
          <GameButton
            onClick={userGambled && gameStarted ? handleCashout : handleBet}
            disabled={disabled}
          >
            {renderMessage()}
          </GameButton>
        </div>
      </div>
    );
  }

  export default SideMenu;
