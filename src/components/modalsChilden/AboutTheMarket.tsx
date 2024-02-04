const AboutMarketSection = ({ title, content }: { title: string, content: string }) => (
    <div className="mb-2">
        <span className="font-bold">{title}: </span>
        <span className="ml-2 text-justify">{content}</span>
    </div>
);

const AboutTheMarket = () => {
    return (
        <div className="flex flex-col text-sm text-white">
            <span className="font-bold text-lg mb-4">About the KaniCasino Market</span>
            <span className="mb-2">
                Explore the virtual marketplace at KaniCasino, where you can buy and sell in-game items with other players. Read on to understand how the market works.
            </span>

            {[
                { title: '1. Item Listing', content: 'Players can list their in-game items for sale on the market, setting prices based on the rarity and demand for each item.' },
                { title: '2. Buying Items', content: 'Browse the market to discover a variety of items available for purchase. Choose items based on your preferences, strategy, and in-game goals.' },
                { title: '3. Selling Items', content: 'Sell your unwanted or duplicate items on the market to earn in-game currency (K₽). Set competitive prices to attract potential buyers.' },
                { title: "4. Market Economy', content: 'The market's economy is driven by the rarity of items and player demand. Keep an eye on trends and adjust your buying and selling strategies accordingly." },
                { title: '5. Player Interactions', content: 'Engage with other players through the market. Negotiate prices, make deals, and build a thriving in-game economy together.' },
                { title: '6. Transparency', content: 'The market operates with transparency. Sellers and buyers can view relevant information about each transaction, fostering a fair and trustworthy environment.' },
            ].map((section, index) => (
                <AboutMarketSection key={index} title={section.title} content={section.content || ''} />
            ))}
        </div>
    );
}

export default AboutTheMarket;
