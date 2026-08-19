import i18n from "../../i18n";
const FrequentlyAskedQuestions = () => {

    const faqData = [
        {
            question: i18n.t("help.isMyPersonalInformation"),
            answer: i18n.t("help.yesWePrioritizeThe")
        },
        {
            question: i18n.t("help.canIUpgradeItems"),
            answer: i18n.t("help.yesYouCanUpgrade")
        },
        {
            question: i18n.t("help.howCanIContact"),
            answer: i18n.t("help.ifYouNeedAssistance")
        },
    ];

    return (
        <div className="p-4">
            <span className="text-2xl font-bold mb-4 ">{i18n.t("help.frequentlyAskedQuestions")}</span>

            <div className="flex flex-col gap-4 mt-2">  {faqData.map((item, index) => (
                <div key={index} className="mb-6">
                    <span className="text-xl font-bold mb-2">{item.question}</span>
                    <p className="">{item.answer}</p>
                </div>
            ))}</div>

        </div>
    );
};

export default FrequentlyAskedQuestions;
