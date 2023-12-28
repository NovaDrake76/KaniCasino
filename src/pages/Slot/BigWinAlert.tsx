import React, { useState, useEffect } from 'react';
import Monetary from '../../components/Monetary';

interface BigWinAlertProps {
    value: number;
}

const BigWinAlert: React.FC<BigWinAlertProps> = ({ value }) => {
    const [scale, setScale] = useState(0);
    const [animatedValue, setAnimatedValue] = useState(0);

    useEffect(() => {
        setTimeout(() => {
            setScale(1);
            animateValue();
        }, 3000);
    }, [value]);

    const animateValue = () => {
        let start = 0;
        const end = value;
        const duration = 4000; // Adjust the duration as needed
        const range = end - start;
        const increment = end > start ? 1 : -1;
        const stepTime = Math.abs(Math.floor(duration / range));
        const timer = setInterval(() => {
            start += increment;
            setAnimatedValue(start);
            if (start === end) {
                clearInterval(timer);
            }
        }, stepTime);
    };

    return (
        <div className='absolute z-50 mb-48 transition-all flex items-center justify-center'
            style={{
                transform: `scale(${scale})`,
                transition: 'transform 0.5s ease-in-out',
                transformOrigin: '50% 50%',
            }}
        >  <div
                className="absolute w-auto rounded-full -z-10 "
                style={{
                    width: "100%",
                    height: "100%",
                    boxShadow: "0px 0px 130px 100px #FFCC00",
                }}
            />
            <div className='flex flex-col items-center justify-center font-bold border-8 border-[#FFB760] p-4 text-white text-2xl bg-[#FFF0EC] gap-2'>
                <span className='text-[#FFB760] text-4xl' style={{ textShadow: '2px 2px 0 #3DA5B7, 2px 2px 0 #3DA5B7,2px 2px 0 #3DA5B7, 2px 2px 0 #3DA5B7' }}>
                    Big Win
                </span>
                <span className='text-[#F5EB6E] text-5xl' style={{ textShadow: '4px 4px 0 #A93400, -4px -4px 0 #A93400, 4px -4px 0 #A93400, -4px 4px 0 #A93400' }}>
                    <Monetary value={animatedValue} />
                </span>
            </div>

        </div>
    );
};

export default BigWinAlert;
