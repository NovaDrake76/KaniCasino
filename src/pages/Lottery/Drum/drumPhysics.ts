import { NUMBERS } from "../lotteryRules";

// the drum in its own units; the canvas scales them to whatever size it is shown at
export const SIZE = 520;
export const CENTER = SIZE / 2;
export const RADIUS = 236;
export const BALL_R = 31;
const GRAVITY = 1500;
// a ball hitting the wall keeps a third of its speed into it, the rest is lost
const BOUNCE = 1.35;
// how much of the gap to the wall's own speed a touching ball takes in a 120th of a second
const GRIP = 0.16;
const KNOCK = 0.9;
const MAX_DT = 1 / 120;
// one push per pair leaves a resting pile visibly sunk into itself; three passes hold it apart
const PASSES = 3;
const TURN = Math.PI * 2;

export interface DrumBall {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
}

export interface DrumState {
  balls: DrumBall[];
  angle: number;
}

// every ball starts at a place worked out from its own number, so two drums built alike move alike
const seat = (n: number): DrumBall => {
  const a = (n * 2.4) % TURN;
  const d = 60 + ((n * 37) % 110);
  return { n, x: CENTER + Math.cos(a) * d, y: CENTER + Math.sin(a) * d * 0.8 + 40, vx: 0, vy: 0, rot: n };
};

export const createDrum = (numbers: number[] = NUMBERS): DrumState => ({ balls: numbers.map(seat), angle: 0 });

const contain = (b: DrumBall, spin: number, grip: number) => {
  const dx = b.x - CENTER;
  const dy = b.y - CENTER;
  const dist = Math.hypot(dx, dy);
  const max = RADIUS - BALL_R;
  if (dist <= max) return;
  const nx = dx / dist;
  const ny = dy / dist;
  b.x = CENTER + nx * max;
  b.y = CENTER + ny * max;
  const vn = b.vx * nx + b.vy * ny;
  if (vn > 0) {
    b.vx -= vn * BOUNCE * nx;
    b.vy -= vn * BOUNCE * ny;
  }
  if (!grip) return;
  const tx = -ny;
  const ty = nx;
  const slip = spin * RADIUS - (b.vx * tx + b.vy * ty);
  b.vx += slip * grip * tx;
  b.vy += slip * grip * ty;
};

const collide = (balls: DrumBall[], knock: boolean) => {
  const reach = BALL_R * 2;
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= reach) continue;
      // two balls on the very same spot have no direction between them, so they are parted sideways
      const nx = d ? dx / d : 1;
      const ny = d ? dy / d : 0;
      const push = (reach - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      if (!knock) continue;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        a.vx += rel * KNOCK * nx;
        a.vy += rel * KNOCK * ny;
        b.vx -= rel * KNOCK * nx;
        b.vy -= rel * KNOCK * ny;
      }
    }
  }
};

const tick = (state: DrumState, dt: number, spin: number) => {
  state.angle = (state.angle + spin * dt) % TURN;
  const grip = 1 - Math.pow(1 - GRIP, dt * 120);
  for (const b of state.balls) {
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    contain(b, spin, grip);
    b.rot = (b.rot + (b.vx / BALL_R) * dt) % TURN;
  }
  for (let pass = 0; pass < PASSES; pass++) {
    collide(state.balls, pass === 0);
    for (const b of state.balls) contain(b, spin, 0);
  }
};

// moves the drum on by dt seconds at spin radians a second, in steps short enough to stay stable; it changes the state it is given
export const step = (state: DrumState, dt: number, spin: number): DrumState => {
  if (!(dt > 0) || !Number.isFinite(dt)) return state;
  const parts = Math.ceil(dt / MAX_DT);
  for (let k = 0; k < parts; k++) tick(state, dt / parts, spin);
  return state;
};

// a still drum: the balls dropped and left to come to rest at the bottom
export const settle = (state: DrumState, seconds = 4): DrumState => step(state, seconds, 0);

export const removeBall = (state: DrumState, n: number): DrumState => {
  state.balls = state.balls.filter((b) => b.n !== n);
  return state;
};

// the balls that went out come back to where they first sat; the ones still inside stay put
export const refill = (state: DrumState): DrumState => {
  const inside = new Set(state.balls.map((b) => b.n));
  state.balls = [...state.balls, ...NUMBERS.filter((n) => !inside.has(n)).map(seat)].sort((a, b) => a.n - b.n);
  return state;
};

// brings the drum to exactly these numbers: a missing one refills it, an extra one is taken out
export const syncDrum = (state: DrumState, numbers: number[]): DrumState => {
  const want = new Set(numbers);
  if (numbers.some((n) => !state.balls.some((b) => b.n === n))) refill(state);
  state.balls = state.balls.filter((b) => want.has(b.n));
  return state;
};
