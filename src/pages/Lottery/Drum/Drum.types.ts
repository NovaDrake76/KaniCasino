import { useDrum } from "./Drum.services";

export type DrumSpeed = "open" | "closed" | "drawing";

export interface DrumProps {
  // the numbers still in the drum; one that goes missing is taken out, all twenty back is a refill
  numbers: number[];
  speed: DrumSpeed;
  label: string;
}

export type DrumViewProps = ReturnType<typeof useDrum>;
