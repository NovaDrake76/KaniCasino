import React, { useEffect, useState } from 'react';

const getInitialAngles = () => {
    const now = new Date();
    const secondsRatio = now.getSeconds() / 60;
    const minutesRatio = 0;
    const hoursRatio = (minutesRatio + now.getHours()) % 12 / 12; // 12-hour format
    return {
        secondsDegrees: secondsRatio * 360,
        minutesDegrees: minutesRatio * 360,
        hoursDegrees: hoursRatio * 360,
    };
};

interface SpinningLogicProps {
    stopAngle: number;
    spinning: boolean;
    totalDuration?: number;
}

const SpinningLogic: React.FC<SpinningLogicProps> = ({
    stopAngle,
    spinning,
    totalDuration = 8000,
}) => {
    const [angles, setAngles] = useState(getInitialAngles());

    useEffect(() => {
        if (spinning) {
            // Spin logic for roulette pointer
            const startTime = Date.now();
            const fullSpins = 3;
            const totalDegrees = fullSpins * 360 + stopAngle;

            const spinFrame = () => {
                const timeElapsed = Date.now() - startTime;
                let progress = timeElapsed / totalDuration;

                if (progress > 1) progress = 1;

                const easeOut = (t: number) => t * (2 - t);
                const newAngle = easeOut(progress) * totalDegrees;

                setAngles((prevAngles) => ({
                    ...prevAngles,
                    minutesDegrees: newAngle,
                    secondsDegrees: newAngle * 2,
                    hoursDegrees: newAngle / 10,
                }));

                if (progress < 1) {
                    requestAnimationFrame(spinFrame);
                }
            };

            requestAnimationFrame(spinFrame);
        } else {
            // Normal clock ticking logic
            const tick = setInterval(() => {
                setAngles(getInitialAngles());
            }, 1000);

            return () => clearInterval(tick);
        }
    }, [stopAngle, spinning, totalDuration]);

    return (
        <>
            {/* Hour Hand */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    width: '14px',
                    height: '30%',
                    transform: `rotate(${angles.hoursDegrees}deg)`,
                    background: 'linear-gradient(to top, transparent, #3b2577)',
                    clipPath: 'polygon(50% 0, 100% 100%, 0% 100%)',
                    transformOrigin: 'bottom',
                    zIndex: 1,
                    transition: spinning ? '6s' : 'none',
                    opacity: spinning ? 0 : 1,
                }}
            />
            {/* Minutes Hand (Roulette Pointer) */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    width: '14px',
                    height: '50%',
                    transformOrigin: 'bottom',
                    transform: `rotate(${angles.minutesDegrees}deg)`,
                    zIndex: 2,
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: '50%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(to top, transparent, #FF0E65)',
                        clipPath: 'polygon(50% 0, 100% 100%, 0% 100%)',
                        transform: 'translateX(-50%)',
                    }}
                ></div>
            </div>
            {/* Seconds Hand */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '50%',
                    left: '50%',
                    width: '4px',
                    height: '50%',
                    transform: `translateX(120%) rotate(${angles.secondsDegrees}deg)`,
                    transformOrigin: 'bottom',
                    background: 'linear-gradient(to top, transparent, #8d6fd4)',
                    clipPath: 'polygon(50% 0, 100% 100%, 0% 100%)',
                    zIndex: 1,
                    transitionDuration: angles.secondsDegrees === 0 ? '0s' : spinning ? '7s' : '0.5s',
                    transitionTimingFunction: spinning ? "cubic-bezier(0,.45,0,1.05)" : "ease-in-out",
                    opacity: spinning ? 0 : 1,
                }}
            />

        </>
    );
};

export default SpinningLogic;
