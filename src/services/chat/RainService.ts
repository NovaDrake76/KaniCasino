import SocketConnection from "../socket";

export interface RainWinner {
  _id: string;
  username: string;
  profilePicture: string | null;
  level: number;
  badge: { key: string } | null;
}

export interface RainState {
  roundId: string;
  startsAt: string;
  endsAt: string;
  // the countdown runs off the server's clock, so a wrong device time cannot skew it
  serverTime: string;
  pool: number;
  joined: boolean;
  minLevel: number;
  maxPerPlayer: number;
  intervalMs: number;
  error?: string;
}

export interface RainSettled {
  roundId: string;
  pool: number;
  paidOut: number;
  winners: RainWinner[];
  next: { roundId: string; endsAt: string; pool: number };
}

const socket = () => SocketConnection.getInstance();

export const requestRain = () => socket().emit("rain:request");

export const joinRain = (): Promise<RainState> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ error: "failed" } as RainState), 8000);
    socket().emit("rain:join", {}, (result: RainState) => {
      clearTimeout(timer);
      resolve(result);
    });
  });

export const onRainState = (fn: (s: RainState) => void) => {
  socket().on("rain:state", fn);
  return () => void socket().off("rain:state", fn);
};

// the pool moves whenever anyone on the site bets, so the server pushes it rather than
// leaving the panel to poll for a figure that is usually unchanged
export const onRainPool = (fn: (p: { roundId: string; pool: number }) => void) => {
  socket().on("rain:pool", fn);
  return () => void socket().off("rain:pool", fn);
};

export const onRainSettled = (fn: (p: RainSettled) => void) => {
  socket().on("rain:settled", fn);
  return () => void socket().off("rain:settled", fn);
};

export const onRainWon = (fn: (p: { amount: number }) => void) => {
  socket().on("rain:won", fn);
  return () => void socket().off("rain:won", fn);
};
