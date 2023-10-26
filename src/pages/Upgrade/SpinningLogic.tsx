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
                width: '2px',
                height: '50%',
                backgroundColor: 'blue',
                transformOrigin: 'bottom',
                transform: `rotate(${angle}deg)`,
            }}
        />
    );
};

export default SpinningLogic;
