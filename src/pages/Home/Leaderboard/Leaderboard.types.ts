import { Board, BoardMe, BoardStanding, PointsGame } from "../../../services/leaderboard/LeaderboardService";

export interface Countdown {
  hours: string;
  minutes: string;
  seconds: string;
}

export interface LeaderboardViewProps {
  loading: boolean;
  board: Board | null;
  // the three podium places, already ordered 2nd / 1st / 3rd the way they are drawn
  podium: BoardStanding[];
  rest: BoardStanding[];
  podiumRest: BoardStanding[];
  countdown: Countdown;
  pool: number;
  paidPlaces: number;
  me: BoardMe | null;
  meOnBoard: boolean;

  points: PointsGame[];
  showPoints: boolean;
  openPoints: () => void;
  closePoints: () => void;
  aside?: React.ReactNode;
}
