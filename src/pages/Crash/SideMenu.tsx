import { User } from '../../components/Types';

interface SideMenuProps {
    bet: number | null;
    setBet: any;
    gameStarted: boolean;
    handleBet: any;
    handleCashout: any;
    isLogged: boolean;
    userGambled: boolean;
    userCashedOut: boolean;
    userData: User;
    userMultiplier: number;
}

const SideMenu: React.FC<SideMenuProps> = ({ bet, setBet, gameStarted, handleBet, handleCashout, isLogged, userGambled, userCashedOut, userData, userMultiplier }) => {

    const renderMessage = () => {
        let message = "";

        if (!isLogged) {
            message = "Sign in to play";
        } else if (userCashedOut) {
            message = `Cashed Out at x${userMultiplier.toFixed(2)}`;
        } else if (userGambled) {
            message = gameStarted ? "Cash Out" : "You're in!";
        } else if (gameStarted) {
            message = "Wait for next round";
        } else if (bet === 0 || !bet || bet < 1) {
            message = "Place the bet value";
        } else if (bet > 1000000) {
            message = "Max bet is 1M";
        } else if (userData.walletBalance < (bet ?? 0)) {
            message = "Not enough money";
        } else {
            message = "Place Bet";
        }
        return message;
    }

    return (
        <div className="lg:w-[340px] flex flex-col items-center gap-4 border-r border-gray-700 py-4 px-6">
            <input
                type="number"
                value={bet || ""}
                onKeyDown={(event) => {
                    if (!/[0-9]/.test(event.key) && event.key !== "Backspace") {
                        event.preventDefault();
                    }
                }}
                max={1000000}
                onChange={(e) => {
                    const value = Number(e.target.value);
                    setBet(value < 0 ? 0 : value);
                }}
                className="p-2 border rounded w-1/2 lg:w-full"
            />
            <button
                onClick={gameStarted ? handleCashout : handleBet}
                className="p-2 border rounded bg-indigo-600 hover:bg-indigo-700 w-full mt-4"
                disabled={
                    (gameStarted && (!userGambled || userCashedOut)) ||
                    (!gameStarted && userGambled) || (!gameStarted && bet === 0 || !bet || bet > 1000000)
                }
            >
                {renderMessage()}
            </button>

        </div>
    )

}

export default SideMenu;