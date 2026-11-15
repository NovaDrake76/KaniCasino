import { DrumViewProps } from "./Drum.types";

const DrumView: React.FC<DrumViewProps> = ({ canvasRef, size, label }) => (
  <canvas
    ref={canvasRef}
    width={size}
    height={size}
    role="img"
    aria-label={label}
    data-testid="drum"
    className="block aspect-square h-auto w-full max-w-[260px] lg:short:max-w-[200px]"
  />
);

export default DrumView;
