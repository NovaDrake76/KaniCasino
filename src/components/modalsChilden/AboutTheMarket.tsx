import i18n from "../../i18n";
const AboutMarketSection = ({ title, content }: { title: string, content: string }) => (
    <div className="mb-2">
        <span className="font-bold">{title}: </span>
        <span className="ml-2 text-justify">{content}</span>
    </div>
);

const AboutTheMarket = () => {
    return (
        <div className="flex flex-col text-sm text-white">
            <span className="font-bold text-lg mb-4">{i18n.t("help.aboutTheKanicasinoMarket")}</span>
            <span className="mb-2">
                {i18n.t("help.exploreTheVirtualMarketplace")}
            </span>

            {[
                { title: i18n.t("help.marketListingTitle"), content: i18n.t("help.marketListingBody") },
                { title: i18n.t("help.marketBuyingTitle"), content: i18n.t("help.marketBuyingBody") },
                { title: i18n.t("help.marketSellingTitle"), content: i18n.t("help.marketSellingBody") },
                { title: i18n.t("help.marketEconomyTitle"), content: i18n.t("help.marketEconomyBody") },
                { title: i18n.t("help.marketInteractionsTitle"), content: i18n.t("help.marketInteractionsBody") },
                { title: i18n.t("help.marketTransparencyTitle"), content: i18n.t("help.marketTransparencyBody") },
            ].map((section, index) => (
                <AboutMarketSection key={index} title={section.title} content={section.content || ''} />
            ))}
        </div>
    );
}

export default AboutTheMarket;
