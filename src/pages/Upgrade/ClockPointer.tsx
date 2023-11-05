import React from 'react';
import SpinningLogic from './SpinningLogic';

interface ClockPointerProps {
    successRate: number;
    spinning: boolean;
    success: boolean;
    stopAngle: number;
    finished: boolean;
}

const ClockPointer: React.FC<ClockPointerProps> = ({ successRate, spinning, success, stopAngle, finished }) => {

    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeLength = circumference * successRate;

    return (
        <div className="relative w-[380px] h-[380px]" style={{
            backgroundImage: `url(/images/clock.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',

        }}>

            <svg className="absolute inset-0" viewBox="-17.2 -27 74.5 100" fill="transparent" style={{}}>
                {/* Background Circle */}
                <circle cx="20" cy="20" r={radius} stroke="transparent" strokeWidth="4" />
                {/* Foreground Circle */}
                <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    stroke="#9c79e6"
                    strokeWidth="2"
                    strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                    transform="rotate(-90 20 20)"
                    style={{ transition: 'stroke-dasharray 1.5s ease-in-out', }}
                />
            </svg>
            {!finished ? (<div className="absolute top-[calc(50%-60px)] left-[calc(50%-7px)] h-[220px]">
                <div className=" inset-0 flex items-center justify-center">
                    <SpinningLogic stopAngle={stopAngle} spinning={spinning} />
                </div>
                <div className="absolute top-[calc(50%-70px)] left-[calc(50%+10px)]  inset-0 flex flex-col items-center justify-center z-20">
                    <span className="font-bold">{`${(successRate * 100).toFixed(2)}%`}</span>

                </div>
            </div>) : (
                <div className={`absolute top-[calc(50%-38px)] left-[calc(50%-87px)] flex flex-col h-44 w-44 items-center justify-center rounded-full `}>
                    {
                        success ? (
                            <div className="flex flex-col items-center justify-center gap-4">
                                <span className="font-semibold">Upgrade Success</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-4">
                                <span className="font-semibold">Upgrade Failed</span>
                            </div>
                        )
                    }
                </div>

            )}
        </div>
    );
};

export default ClockPointer;
