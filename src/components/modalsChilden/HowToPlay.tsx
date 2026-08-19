import i18n from "../../i18n";
const HowToPlaySection = ({ title, content }: { title: string, content: string }) => (
    <div className="mb-2">
        <span className="font-bold">{title}: </span>
        <span className="ml-2 text-justify">{content}</span>
    </div>
);

const HowToPlay = () => {
    return (
        <div className="flex flex-col text-sm text-white">
            <span className="font-bold text-lg mb-4">{i18n.t("help.howToPlayAt")}</span>


            {[
                { title: i18n.t("help.playLoginTitle"), content: i18n.t("help.playLoginBody") },
                { title: i18n.t("help.playBalanceTitle"), content: i18n.t("help.playBalanceBody") },
                { title: i18n.t("help.playBonusTitle"), content: i18n.t("help.playBonusBody") },
                { title: i18n.t("help.playCasesTitle"), content: i18n.t("help.playCasesBody") },
                { title: i18n.t("help.playGamesTitle"), content: i18n.t("help.playGamesBody") },
                { title: i18n.t("help.playMarketTitle"), content: i18n.t("help.playMarketBody") },
            ].map((section, index) => (
                <HowToPlaySection key={index} title={section.title} content={section.content} />
            ))}


        </div>
    );
}

export default HowToPlay;
