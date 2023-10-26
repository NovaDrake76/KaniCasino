import React from 'react';
import SpinningLogic from './SpinningLogic';

interface ClockPointerProps {
    successRate: number;
    spinning: boolean;
    success: boolean;
    stopAngle: number;
}

const ClockPointer: React.FC<ClockPointerProps> = ({ successRate, spinning, success, stopAngle }) => {

    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeLength = circumference * successRate;

    return (
        <div className="relative w-40 h-40">
            <svg className="absolute inset-0" viewBox="0 0 40 40">
                {/* Background Circle */}
                <circle cx="20" cy="20" r={radius} stroke="transparent" strokeWidth="4" />
                {/* Foreground Circle */}
                <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    stroke="blue"
                    strokeWidth="2"
                    strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                    transform="rotate(-90 20 20)"
                    style={{ transition: 'stroke-dasharray 1.5s ease-in-out' }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
                <SpinningLogic stopAngle={stopAngle} spinning={spinning} />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center mt-12">
                <span className="text-blue-500">{`${(successRate * 100).toFixed(2)}%`}</span>
                {
                    success && (
                        <span className="text-green-500">Success</span>
                    )

                }
            </div>
        </div>
    );
};

export default ClockPointer;
