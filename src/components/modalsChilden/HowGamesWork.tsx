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
                {i18n.t("help.welcomeToTheGaming")}
            </p>

            <GameDescription
                title={i18n.t("help.coinFlipGame")}
                description="In the Coin Flip game, players can place bets on either heads or tails. The game starts automatically, and after a brief period, the result is revealed. If a player's choice matches the result, they win and receive a 2X payout."
            />

            <GameDescription
                title={i18n.t("help.crashGame")}
                description={i18n.t("help.theCrashGameFeatures")}
            />

            <GameDescription
                title={i18n.t("help.slotGame")}
                description={i18n.t("help.inTheSlotGame")}
            />

            <GameDescription
                title={i18n.t("help.upgradeItems")}
                description={i18n.t("help.theUpgradeItemsFeature")}
            />

            <p className="text-lg">
                {i18n.t("help.enjoyPlayingTheGames")}
            </p>
        </div>
    );
};

export default HowGamesWork;
