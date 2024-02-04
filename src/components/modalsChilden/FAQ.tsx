const FrequentlyAskedQuestions = () => {

    const faqData = [
        {
            question: 'Is my personal information safe?',
            answer: 'Yes, we prioritize the security of your personal information. We use industry-standard encryption and follow best practices to ensure your data is kept safe and secure.'
        },
        {
            question: 'Can I upgrade items in my inventory?',
            answer: 'Yes, you can upgrade items by selecting them and choosing a target item with a higher rarity. The success rate depends on the rarity of the items.'
        },
        {
            question: 'How can I contact support?',
            answer: 'If you need assistance or have any questions, you can contact us via email at novadrake76@gmail.com or on Discord: novadrake76'
        },
    ];

    return (
        <div className="p-4">
            <span className="text-2xl font-bold mb-4 ">Frequently Asked Questions</span>

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
