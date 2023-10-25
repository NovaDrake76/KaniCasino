import React, { useEffect, useState } from 'react';

interface SpinningLogicProps {
    stopAngle: number;
    spinning: boolean;
    totalDuration?: number;
}

const SpinningLogic: React.FC<SpinningLogicProps> = ({ stopAngle, spinning, totalDuration = 8000 }) => {
    const [angle, setAngle] = useState(0);

    useEffect(() => {
        if (!spinning) {
            return;
        }
        const startTime = Date.now();
        const fullSpins = 4; // Total 4 spins
        let hasSlowedDown = false; // To control the slowing down of the last spin

        const frame = () => {
            const timeElapsed = Date.now() - startTime;
            let progress = timeElapsed / totalDuration;

            if (progress > 1) {
                progress = 1;
            }

            let spinSpeedFactor = 1;
            if (progress >= (3 / 4) && !hasSlowedDown) {
                hasSlowedDown = true;
                spinSpeedFactor = 0.5; // slow down the last spin
            }

            let newAngle = fullSpins * 360 * progress * spinSpeedFactor + stopAngle * progress;
            newAngle *= Math.sin((progress * Math.PI) / 2);

            setAngle(newAngle);

            if (progress < 1) {
                requestAnimationFrame(frame);
            } else {
                setTimeout(() => setAngle(0), 1000); // Reset to the initial position
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
                transition: !spinning ? 'transform 2s ease-out' : undefined,
            }}
        />
    );
};

export default SpinningLogic;
