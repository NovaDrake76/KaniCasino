import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

import headsImg from '/images/coinHeads.webp';
import tailsImg from '/images/coinTails.webp';
import purpleImg from '/images/coinPurple.webp';

interface CoinProps {
    result: number | null;
    spinning: boolean;
    // the coin has a third side only while the purple bet is open
    purple?: boolean;
}

// the back face is the one showing at rest (heads, red) and the front is tails. purple is the back
// face wearing another picture, changed only while that face is turned away from the viewer
const TURNS = 10;
const FAST_MS = 5000;
const hidden = (rotateY: number) => {
    const a = ((rotateY % 360) + 360) % 360;
    return a > 100 && a < 260;
};

const Coin: React.FC<CoinProps> = ({ result, spinning, purple }) => {
    const controls = useAnimation();
    const [backImg, setBackImg] = useState(tailsImg);
    const pending = useRef<string | null>(null);
    const timers = useRef<number[]>([]);

    useEffect(() => {
        const clear = () => {
            timers.current.forEach((t) => window.clearTimeout(t));
            timers.current = [];
        };
        clear();
        if (spinning) {
            controls.set({ rotateY: 0 });
            controls.start({ rotateY: 360 * TURNS, transition: { duration: FAST_MS / 1000, ease: "linear" } });
            if (purple) {
                // two of the middle turns show the magic side, so the coin is seen to have one
                const flashes = new Set([2 + Math.floor(Math.random() * 3), 6 + Math.floor(Math.random() * 2)]);
                for (let k = 0; k < TURNS; k++) {
                    timers.current.push(window.setTimeout(() => {
                        pending.current = flashes.has(k) ? purpleImg : tailsImg;
                    }, (k * FAST_MS) / TURNS));
                }
            }
            return clear;
        }
        if (result === null) {
            // nothing in flight: rest on heads without a spin
            controls.set({ rotateY: 0 });
            pending.current = null;
            setBackImg(tailsImg);
            return clear;
        }
        // heads and purple land on the back face, tails on the front
        pending.current = result === 2 ? purpleImg : tailsImg;
        controls.start({ rotateY: 360 * TURNS + (result === 1 ? 540 : 360), transition: { duration: 2, ease: [0.33, 1, 0.68, 1] } });
        return clear;
    }, [spinning, result, purple, controls]);

    return (
        <motion.div
            className="coin"
            animate={controls}
            onUpdate={(latest) => {
                if (pending.current && hidden(Number(latest.rotateY) || 0)) {
                    setBackImg(pending.current);
                    pending.current = null;
                }
            }}
        >
            <div className="face front" style={{ backgroundImage: `url(${headsImg})` }} />
            <div className="face back" style={{ backgroundImage: `url(${backImg})` }} />
        </motion.div>
    );
};

export default Coin;
