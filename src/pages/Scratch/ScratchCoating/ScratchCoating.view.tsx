import { FLECK_PAD } from "./ScratchCoating.services";
import { ScratchCoatingViewProps } from "./ScratchCoating.types";

const pad = `${-FLECK_PAD * 100}%`;
const span = `${(1 + 2 * FLECK_PAD) * 100}%`;

const ScratchCoatingView: React.FC<ScratchCoatingViewProps> = ({ canvasRef, flecksRef, pointer, style, testId }) => (
  <>
    <canvas ref={canvasRef} data-testid={testId} className="absolute inset-0 h-full w-full select-none" style={style} {...pointer} />
    <canvas
      ref={flecksRef}
      aria-hidden
      className="pointer-events-none absolute z-raised"
      style={{ left: pad, top: pad, width: span, height: span }}
    />
  </>
);

export default ScratchCoatingView;
