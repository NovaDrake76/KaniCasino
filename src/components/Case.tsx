import { useState } from "react";
import { RotatingLines } from "react-loader-spinner";
import Monetary from "./Monetary";

interface CaseProps {
  id: string;
  title: string;
  image: string;
  price: number;
  // above the fold: fetch it eagerly and let it jump the queue, since the first of
  // these is the largest thing on the homepage
  priority?: boolean;
}

const Case: React.FC<CaseProps> = ({ id, title, image, price, priority }) => {
  const [hover, setHover] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  return (
    <div
      className="flex flex-col w-64 items-center rounded transition-all"
      key={id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        boxShadow: hover ? `0px 0px 20px 10px #3D2A5B` : "none",
        transform: hover ? "scale(1.01)" : "scale(1)",
      }}
    >
      {/* the wrapper reserves the image's height at every breakpoint so the card does not
          collapse when the art lands, and the spinner sits on top rather than in flow.
          the image is faded, never display:none: a lazy image that is display:none never
          intersects the viewport, so the browser never fetches it, onLoad never fires and
          it stays hidden for good. */}
      <div className="relative w-full h-32 md:h-64 flex items-center justify-center">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RotatingLines
              strokeColor="grey"
              strokeWidth="5"
              animationDuration="0.75"
              width="50px"
              visible={true}
            />
          </div>
        )}
        <img
          src={image}
          alt={title}
          loading={priority ? "eager" : "lazy"}
          fetchpriority={priority ? "high" : undefined}
          className={`w-1/2 md:w-full h-32 md:h-64 object-cover -ml-4 transition-opacity ${loaded ? "" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </div>
      <div className="flex flex-col gap-2 p-4 items-center w-full">
        <div className="font-bold text-lg text-center w-full">{title}</div>
        {/* clip-path clips borders, so the chip outline is an outer notched div (see Banner) */}
        <div className="notched-sm bg-line p-[1px] w-fit">
          <div className="notched-sm bg-surface-deep px-5 py-1 font-semibold text-sm text-green-400">
            <Monetary value={price} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Case;
