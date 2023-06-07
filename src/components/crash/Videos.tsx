import React, { useState, useEffect, useRef } from 'react';

interface VideosProps {
    animationSrc: string;
    setAnimationSrc: React.Dispatch<React.SetStateAction<string>>;
    falling: string;
    idle: string;
    up: string;
}

const Videos: React.FC<VideosProps> = ({ animationSrc, setAnimationSrc, falling, idle, up }) => {
    const [elements, setElements] = useState<JSX.Element[]>([]);
    const idleRef = useRef<HTMLImageElement>(null);
    const upRef = useRef<HTMLImageElement>(null);
    const fallingRef = useRef<HTMLImageElement>(null);
    const animationEndHandler = () => {
        if (animationSrc === idle) setAnimationSrc(falling);
        else if (animationSrc === falling) setAnimationSrc(up);
        else if (animationSrc === up) setAnimationSrc(idle);
    };

    // Preload images
    useEffect(() => {
        const imgIdle = new Image();
        imgIdle.src = idle;
        const imgUp = new Image();
        imgUp.src = up;
        const imgFalling = new Image();
        imgFalling.src = falling;
    }, [idle, up, falling]);

    useEffect(() => {
        const newElement = (
            <img
                style={{ display: 'block' }}
                src={animationSrc}
                ref={animationSrc === idle ? idleRef : animationSrc === up ? upRef : fallingRef}
                onEnded={animationEndHandler}
            />
        );
        setElements(prevElements => [...prevElements, newElement]);
    }, [animationSrc]);

    useEffect(() => {
        if (idleRef.current) idleRef.current.addEventListener('ended', animationEndHandler);
        if (upRef.current) upRef.current.addEventListener('ended', animationEndHandler);
        if (fallingRef.current) fallingRef.current.addEventListener('ended', animationEndHandler);
        return () => {
            if (idleRef.current) idleRef.current.removeEventListener('ended', animationEndHandler);
            if (upRef.current) upRef.current.removeEventListener('ended', animationEndHandler);
            if (fallingRef.current) fallingRef.current.removeEventListener('ended', animationEndHandler);
        };
    }, [idleRef, upRef, fallingRef]);

    return (
        <div className='absolute bottom-0'>
            {elements.map((element, index) => (
                <div key={index} style={{ display: index === elements.length - 1 ? 'block' : 'none' }}>
                    {element}
                </div>
            ))}
        </div>
    );
};

export default Videos;
