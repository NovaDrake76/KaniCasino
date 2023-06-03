interface VideosProps {
    idleVideoRef: React.RefObject<HTMLVideoElement>;
    flyingVideoRef: React.RefObject<HTMLVideoElement>;
    upVideoRef: React.RefObject<HTMLVideoElement>;
    fallingVideoRef: React.RefObject<HTMLVideoElement>;
    animationSrc: string;
    setAnimationSrc: React.Dispatch<React.SetStateAction<string>>;
    falling: string;
    flying: string;
    idle: string;
    up: string;
}


const Videos: React.FC<VideosProps> = ({ idleVideoRef, flyingVideoRef, upVideoRef, fallingVideoRef, animationSrc, setAnimationSrc, falling, flying, idle, up }) => {
    return (
        <>
            <video
                ref={flyingVideoRef}
                src={flying}
                muted
                preload="auto"
                playsInline
                onLoadedData={() => flyingVideoRef.current?.play()} // start playback after video is loaded
                onEnded={() => {
                    upVideoRef.current?.play();
                    setAnimationSrc(up);
                    upVideoRef.current && (upVideoRef.current.currentTime = 0);
                }}
                style={{ visibility: animationSrc === flying ? 'visible' : 'hidden' }}
                className="w-[250px] h-[250px] absolute bottom-0"
            />
            <video
                ref={upVideoRef}
                src={up}
                loop
                preload="auto"
                muted
                playsInline
                onLoadedData={() => upVideoRef.current?.play()} // start playback after video is loaded
                style={{ visibility: animationSrc === up ? 'visible' : 'hidden' }}
                className="w-[250px] h-[250px] absolute bottom-0"
            />
            <video
                ref={fallingVideoRef}
                src={falling}
                muted
                preload="auto"
                playsInline
                onLoadedData={() => fallingVideoRef.current?.play()} // start playback after video is loaded
                onEnded={() => {
                    setAnimationSrc(idle);
                    idleVideoRef.current && (idleVideoRef.current.currentTime = 0)
                    idleVideoRef.current?.play();
                }}
                style={{ visibility: animationSrc === falling ? 'visible' : 'hidden' }}
                className="w-[250px] h-[250px] absolute bottom-0"
            />
            <video
                ref={idleVideoRef}
                src={idle}
                loop
                muted
                preload="auto"
                playsInline
                onLoadedData={() => idleVideoRef.current?.play()} // start playback after video is loaded
                style={{ visibility: animationSrc === idle ? 'visible' : 'hidden' }}
                className="w-[250px] h-[250px] absolute bottom-0"
            /></>
    )
}

export default Videos