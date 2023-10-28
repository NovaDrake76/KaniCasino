import React, { useEffect, useState } from 'react';

interface SpinningLogicProps {
    stopAngle: number;
    spinning: boolean;
    totalDuration?: number;
}

const SpinningLogic: React.FC<SpinningLogicProps> = ({ stopAngle, spinning, totalDuration = 8000 }) => {
    const [angle, setAngle] = useState(0);
    const fullSpins = 3;
    const totalDegrees = fullSpins * 360 + stopAngle;

    useEffect(() => {
        if (!spinning) {
            return;
        }

        const startTime = Date.now();

        const frame = () => {
            const timeElapsed = Date.now() - startTime;
            let progress = timeElapsed / totalDuration;

            if (progress > 1) {
                progress = 1;
            }

            const easeOut = (t: number) => t * (2 - t);

            const newAngle = easeOut(progress) * totalDegrees;

            setAngle(newAngle);

            if (progress < 1) {
                requestAnimationFrame(frame);
            }
        };

        requestAnimationFrame(frame);
    }, [stopAngle, spinning, totalDuration]);

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '50%',
                left: '50%',
                width: '14px',
                height: '50%',
                transformOrigin: 'bottom',
                transform: `rotate(${angle}deg)`,
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

    );
};

export default SpinningLogic;
