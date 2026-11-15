import { useClock } from "./Clock.services";

export interface ClockProps {
  // the moment it counts down to, on the server's clock
  endsAt: number;
  // how far the device clock runs ahead of the server's, in ms
  skew: number;
}

export type ClockViewProps = ReturnType<typeof useClock>;
