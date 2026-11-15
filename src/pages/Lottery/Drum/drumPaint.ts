import { rangeColor } from "../ballColors";
import { BALL_R, CENTER, DrumState, RADIUS, SIZE } from "./drumPhysics";

const GLASS_LIGHT = "#3D3970";
const GLASS_DARK = "#16142B";
const RIM = "#4A4675";
const STUD = "#8A85C4";
const DISC = "#FFFFFF";
const INK = "#151225";
const STUDS = 12;

// one frame of the drum: the glass, the balls, then the rim and the shine over them
export const paintDrum = (ctx: CanvasRenderingContext2D, state: DrumState, scale: number, font: string) => {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);

  const glass = ctx.createRadialGradient(CENTER - 80, CENTER - 100, 20, CENTER, CENTER, RADIUS);
  glass.addColorStop(0, GLASS_LIGHT);
  glass.addColorStop(1, GLASS_DARK);
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `800 26px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const b of state.balls) {
    ctx.fillStyle = rangeColor(b.n);
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.fillStyle = DISC;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(String(b.n), 0, 2);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(b.x - BALL_R * 0.42, b.y - BALL_R * 0.46, BALL_R * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = RIM;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, RADIUS + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = STUD;
  for (let k = 0; k < STUDS; k++) {
    const a = state.angle + (k * Math.PI * 2) / STUDS;
    ctx.beginPath();
    ctx.arc(CENTER + Math.cos(a) * (RADIUS + 4), CENTER + Math.sin(a) * (RADIUS + 4), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const shine = ctx.createLinearGradient(CENTER - RADIUS, CENTER - RADIUS, CENTER, CENTER);
  shine.addColorStop(0, "rgba(255,255,255,0.16)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.ellipse(CENTER - 70, CENTER - 96, 120, 58, -0.7, 0, Math.PI * 2);
  ctx.fill();
};
