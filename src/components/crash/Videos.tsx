import React from 'react';

interface VideosProps {
    idleImgRef: React.RefObject<HTMLImageElement>;
    upImgRef: React.RefObject<HTMLImageElement>;
    fallingImgRef: React.RefObject<HTMLImageElement>;
    animationSrc: string;
    setAnimationSrc: React.Dispatch<React.SetStateAction<string>>;
    falling: string;
    idle: string;
    up: string;
}

const Videos: React.FC<VideosProps> = ({ idleImgRef, upImgRef, fallingImgRef, animationSrc, setAnimationSrc, falling, idle, up }) => {
    const [key, setKey] = React.useState<number>(0);

    React.useEffect(() => {
        idleImgRef.current?.addEventListener('ended', () => setAnimationSrc(idle));
        upImgRef.current?.addEventListener('ended', () => setAnimationSrc(falling));
        fallingImgRef.current?.addEventListener('ended', () => {
            setAnimationSrc(idle);
            setKey(prevKey => prevKey + 1); // Increase key to force re-render
        });

        return () => {
            idleImgRef.current?.removeEventListener('ended', () => setAnimationSrc(idle));
            upImgRef.current?.removeEventListener('ended', () => setAnimationSrc(falling));
            fallingImgRef.current?.removeEventListener('ended', () => setAnimationSrc(idle));
        }
    }, [idleImgRef, upImgRef, fallingImgRef]);

    return (
        <div>
            <img
                style={{ display: animationSrc === idle ? 'block' : 'none' }}
                src={idle}
                ref={idleImgRef}
            />
            <img
                style={{ display: animationSrc === up ? 'block' : 'none' }}
                src={up}
                ref={upImgRef}
            />
            <img
                key={key} // Force re-render with new key
                style={{ display: animationSrc === falling ? 'block' : 'none' }}
                src={falling}
                ref={fallingImgRef}
            />
        </div>
    );
};

export default Videos;
