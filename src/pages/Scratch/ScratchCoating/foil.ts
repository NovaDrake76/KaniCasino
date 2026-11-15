// the foil from the approved ticket design: a silver sheen with a fine hatch, the label painted into it so it goes away
// exactly where the player rubs
const SHEEN: [number, string][] = [[0, "#c9ced6"], [0.45, "#eef1f5"], [0.55, "#aab1bc"], [1, "#d7dbe2"]];
export const FLECK_COLORS = ["#eef1f5", "#c9ced6", "#aab1bc"];

export const paintFoil = (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number, label: string) => {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const sheen = ctx.createLinearGradient(0, 0, width, height);
  for (const [at, color] of SHEEN) sheen.addColorStop(at, color);
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(90, 98, 112, 0.28)";
  ctx.lineWidth = dpr;
  for (let x = -height; x < width; x += 7 * dpr) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }

  if (label) {
    ctx.fillStyle = "rgba(60, 68, 84, 0.55)";
    ctx.font = `800 ${Math.round(width / 11)}px Montserrat, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, width / 2, height / 2, width * 0.9);
  }
  ctx.restore();
};

// a round brush, solid out to `core` of its radius and feathered past it, drawn once and stamped with destination-out
export const makeBrush = (radius: number, core: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.max(2, Math.ceil(radius * 2));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fall = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  fall.addColorStop(0, "rgba(0, 0, 0, 1)");
  fall.addColorStop(core, "rgba(0, 0, 0, 1)");
  fall.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = fall;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
};

const COIN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>" +
  "<circle cx='16' cy='16' r='13' fill='#FFCC00' stroke='#9a6b00' stroke-width='2'/>" +
  "<circle cx='16' cy='16' r='8.5' fill='none' stroke='#9a6b00' stroke-width='1.5'/>" +
  "<path d='M13 11v10M13 16l5-5M14.5 15l4 6' stroke='#9a6b00' stroke-width='2' stroke-linecap='round' fill='none'/></svg>";

export const COIN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(COIN_SVG)}") 16 16, pointer`;
