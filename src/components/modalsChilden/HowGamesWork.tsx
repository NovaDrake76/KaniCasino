import i18n from "../../i18n";
const GameDescription = ({ title, description }: { title: string; description: string }) => (
    <div className="mb-8">
        <span className="text-xl font-bold mb-2">{title}</span>
        <p className=" text-justify">{description}</p>
    </div>
);

const HowGamesWork = () => {
    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">{i18n.t("footer.howGamesWork")}</h2>
            <p className="mb-4">
                Welcome to the gaming section! Here's a brief overview of how each game works:
            </p>

            <GameDescription
                title={i18n.t("help.coinFlipGame")}
                description="In the Coin Flip game, players can place bets on either heads or tails. The game starts automatically, and after a brief period, the result is revealed. If a player's choice matches the result, they win and receive a 2X payout."
            />

            <GameDescription
                title={i18n.t("help.crashGame")}
                description="The Crash Game features a multiplier that grows over time. Players can place bets and choose to cash out at any point before the game crashes. If a player cashes out successfully, they receive a payout based on the current multiplier."
            />

            <GameDescription
                title={i18n.t("help.slotGame")}
                description="In the Slot Game, players spin a slot machine with various symbols. Different symbol combinations result in wins with varying payouts. The cat symbol is the highest paying symbol, and it can substitute for any other symbol."
            />

            <GameDescription
                title={i18n.t("help.upgradeItems")}
                description="The Upgrade Items feature allows users to select multiple items from their inventory and attempt to upgrade them to a higher rarity. The success rate is calculated based on the selected items and the target rarity."
            />

            <p className="text-lg">
                Enjoy playing the games and good luck!
            </p>
        </div>
    );
};

export default HowGamesWork;
