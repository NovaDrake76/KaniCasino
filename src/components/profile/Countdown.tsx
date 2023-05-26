import { useState, useEffect } from 'react';

interface CountdownProps {
    nextBonus: any;
}

const Countdown: React.FC<CountdownProps> = ({ nextBonus }) => {
    const [untilNextBonus, setUntilNextBonus] = useState<string>("00:01:00");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const bonusTime = new Date(nextBonus).getTime();
            const difference = bonusTime - now;
            const seconds = Math.floor(difference / 1000);
            const result = new Date(seconds * 1000).toISOString().substring(14, 19)
            setUntilNextBonus(result);
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [nextBonus]);

    return (
        <div >
            {untilNextBonus !== "00:00:00" ? (
                <p className='font-bold text-[#2d2b49]'>Next bonus in {untilNextBonus}</p>
            ) : (
                <p className='font-bold text-[#4b4969]'>Bonus available now!</p>
            )}
        </div>
    );
};

export default Countdown;