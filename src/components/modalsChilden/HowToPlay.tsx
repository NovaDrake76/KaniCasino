const HowToPlaySection = ({ title, content }: { title: string, content: string }) => (
    <div className="mb-2">
        <span className="font-bold">{title}: </span>
        <span className="ml-2 text-justify">{content}</span>
    </div>
);

const HowToPlay = () => {
    return (
        <div className="flex flex-col text-sm text-white">
            <span className="font-bold text-lg mb-4">How to Play at KaniCasino</span>


            {[
                { title: '1. Log In', content: 'Sign in to your account to start playing. If you don\'t have an account, you may need to register.' },
                { title: '2. Starting Balance', content: 'Upon logging in, you will receive an initial balance of K₽1000.' },
                { title: '3. Bonus Every 8 Minutes', content: 'Every 8 minutes, you receive a bonus. The bonus amount is calculated as K₽200 multiplied by 10% of your current level.' },
                { title: '4. Open Cases', content: 'Explore the case system. Opening cases can reward you with various in-game items. The rarity of items may affects their value.' },
                { title: '5. Play Games', content: 'Engage in live games like Crash and Coin Flip to increase your balance. Successful gameplay contributes to your overall level - you win 5XP for every K₽1 spent.' },
                { title: '6. Buy and Sell Items', content: 'Visit the Marketplace to buy and sell items. Create an economy based on the rarity of items and market demand.' },
            ].map((section, index) => (
                <HowToPlaySection key={index} title={section.title} content={section.content} />
            ))}


        </div>
    );
}

export default HowToPlay;
