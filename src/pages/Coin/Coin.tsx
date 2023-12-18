import { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

import headsImg from '/images/coinHeads.webp';
import tailsImg from '/images/coinTails.webp';

interface CoinProps {
    result: number | null;
    spinning: boolean;
}

const Coin: React.FC<CoinProps> = ({ result, spinning }) => {
    const controls = useAnimation();

    useEffect(() => {
        const spinCoin = () => {
            controls.set({ rotateY: 0 });
            controls.start({ rotateY: 3600, transition: { duration: 5, ease: "linear" } }); // Fast-spin
        };

        const slowSpin = () => {
            controls.start({ rotateY: result === 0 ? 3600 + 360 : 3600 + 540, transition: { duration: 2, ease: [0.33, 1, 0.68, 1] } }); // Slow-spin to the final result
        };

        if (spinning) {
            spinCoin();
        } else {
            slowSpin();
        }
    }, [spinning, result, controls]);

    return (
        <motion.div className="coin" animate={controls}>
            <div className="face front" style={{ backgroundImage: `url(${headsImg})` }} />
            <div className="face back" style={{ backgroundImage: `url(${tailsImg})` }} />
        </motion.div>
    );
};

export default Coin;
