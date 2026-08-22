import i18n from "../../i18n";
import { FanCardData, FanCardStyleId } from "./cardTypes";

export const CARD_W = 1200;
export const CARD_H = 630;
const SITE = "kanicasino.com";

const RARITY: Record<string, string> = {
  "1": "#4B69FF",
  "2": "#8847FF",
  "3": "#D32CE6",
  "4": "#EB4B4B",
  "5": "#FFFF6E",
};

type Ctx = CanvasRenderingContext2D;
type Sizer = (size: number) => string;

const t = (key: string, vars?: Record<string, unknown>) => i18n.t(`fanCard.${key}`, vars || {}) as string;

const gapOf = (d: FanCardData) => Math.max(0, d.count - d.second);
const isTied = (d: FanCardData) => gapOf(d) === 0;

function fit(ctx: Ctx, text: string, max: number, start: number, mk: Sizer) {
  let size = start;
  while (size > 8) {
    ctx.font = mk(size);
    if (ctx.measureText(text).width <= max) break;
    size -= 1;
  }
  ctx.font = mk(size);
  return size;
}

// canvas has no letter-spacing in every browser we serve, so tracked lines are drawn a
// glyph at a time
function track(ctx: Ctx, text: string, x: number, y: number, sp: number, align: "left" | "center" | "right") {
  const total = [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width + sp, -sp);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + sp;
  }
}

function wrap(ctx: Ctx, text: string, max: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function off(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, x: c.getContext("2d", { willReadFrequently: true }) as Ctx };
}

function grain(ctx: Ctx, amt: number, alpha: number) {
  const { c, x } = off(CARD_W, CARD_H);
  const data = x.createImageData(CARD_W, CARD_H);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const v = 128 + (Math.random() * 2 - 1) * amt;
    p[i] = v;
    p[i + 1] = v;
    p[i + 2] = v;
    p[i + 3] = 255;
  }
  x.putImageData(data, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = alpha;
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

function distress(ctx: Ctx, n: number, scale: number) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.05 + Math.random() * 0.28;
    const r = 0.6 + Math.random() * scale * 0.5;
    ctx.beginPath();
    ctx.ellipse(Math.random() * CARD_W, Math.random() * CARD_H, r, r * (0.1 + Math.random() * 0.28), Math.random() * Math.PI, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

// print wear punches holes, so the inked layers are built apart and dropped onto the
// paper colour rather than onto nothing
function inky(ctx: Ctx, draw: (x: Ctx) => void, n: number, scale: number) {
  const { c, x } = off(CARD_W, CARD_H);
  draw(x);
  distress(x, n, scale);
  ctx.drawImage(c, 0, 0);
}

function rays(ctx: Ctx, cx: number, cy: number, n: number, r: number, a: string, b: string, rot: number) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, rot + (i / n) * Math.PI * 2, rot + ((i + 1) / n) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
}

function scanlines(ctx: Ctx, step: number, alpha: number) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < CARD_H; y += step) ctx.fillRect(0, y, CARD_W, 1);
}

function vignette(ctx: Ctx, alpha: number) {
  const g = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, 180, CARD_W / 2, CARD_H / 2, 780);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: number[], b: number[], t2: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t2));

// the art is a 256px square with its own background, not a cutout, so every treatment
// here resamples it rather than assuming a silhouette
function tint(img: CanvasImageSource, size: number, map: (lum: number) => number[]) {
  const { c, x } = off(size, size);
  x.drawImage(img, 0, 0, size, size);
  const data = x.getImageData(0, 0, size, size);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 24) {
      p[i + 3] = 0;
      continue;
    }
    const lum = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;
    const col = map(lum);
    p[i] = col[0];
    p[i + 1] = col[1];
    p[i + 2] = col[2];
  }
  x.putImageData(data, 0, 0);
  return c;
}

const stencil = (img: CanvasImageSource, size: number, levels: string[]) => {
  const cols = levels.map(hex);
  return tint(img, size, (lum) => cols[Math.min(cols.length - 1, Math.floor(lum * cols.length))]);
};

function sticker(ctx: Ctx, img: CanvasImageSource, size: number, x0: number, y0: number, ring: number, col: string) {
  const sil = tint(img, size, () => hex(col));
  for (let a = 0; a < 40; a++) {
    const angle = (a / 40) * Math.PI * 2;
    ctx.drawImage(sil, x0 + Math.cos(angle) * ring, y0 + Math.sin(angle) * ring, size, size);
  }
}

function notched(ctx: Ctx, x: number, y: number, w: number, h: number, n: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + n);
  ctx.lineTo(x + n, y);
  ctx.lineTo(x + w - n, y);
  ctx.lineTo(x + w, y + n);
  ctx.lineTo(x + w, y + h - n);
  ctx.lineTo(x + w - n, y + h);
  ctx.lineTo(x + n, y + h);
  ctx.lineTo(x, y + h - n);
  ctx.closePath();
}

type Draw = (ctx: Ctx, d: FanCardData, img: CanvasImageSource) => void;

const DRAW: Record<FanCardStyleId, Draw> = {
  pinned(ctx, d, img) {
    const rare = RARITY[d.rarity] || "#605BFF";
    const bg = ctx.createLinearGradient(0, CARD_H, CARD_W, 0);
    bg.addColorStop(0, "#151225");
    bg.addColorStop(1, "#3E2A5C");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const cx = 130;
    const cy = 118;
    const cw = 940;
    const ch = 394;
    ctx.save();
    notched(ctx, cx, cy, cw, ch, 26);
    ctx.clip();
    ctx.fillStyle = "#1C1734";
    ctx.fillRect(cx, cy, cw, ch);
    const g = ctx.createLinearGradient(cx + cw, 0, cx, 0);
    g.addColorStop(0, rare);
    g.addColorStop(0.2, rare);
    g.addColorStop(1, `${rare}00`);
    ctx.fillStyle = g;
    ctx.fillRect(cx, cy, cw, ch);

    ctx.textAlign = "center";
    if (d.desc) {
      ctx.fillStyle = "#DDDCFC";
      ctx.font = '600 64px Montserrat';
      ctx.fillText("“", cx + 148, cy + 190);
      ctx.fillText("”", cx + 448, cy + 190);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = '600 30px Montserrat';
      wrap(ctx, d.desc, 250).slice(0, 3).forEach((line, i) => ctx.fillText(line, cx + 298, cy + 172 + i * 38));
    }
    ctx.drawImage(img, cx + cw - 300, cy + 66, 190, 190);
    ctx.font = '700 30px Montserrat';
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(d.name, cx + cw - 205, cy + 300);
    ctx.textAlign = "left";
    ctx.restore();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = '800 34px Montserrat';
    ctx.fillText(d.holder, cx, cy - 26);
    ctx.fillStyle = "#8F88B4";
    ctx.font = '600 26px Montserrat';
    ctx.fillText(t("pinnedLine", { count: d.count, site: SITE }), cx, cy + ch + 46);
  },

  notice(ctx, d, img) {
    const cream = "#DDD4B6";
    const olive = "#3B4030";
    const red = "#B03A22";
    ctx.fillStyle = cream;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    inky(
      ctx,
      (x) => {
        x.fillStyle = olive;
        x.fillRect(720, 0, CARD_W - 720, CARD_H);
        x.fillStyle = red;
        x.fillRect(0, CARD_H - 78, CARD_W, 78);
        x.drawImage(stencil(img, 440, [olive, "#6E7355", cream]), 745, 74, 440, 440);
        x.strokeStyle = cream;
        x.lineWidth = 3;
        x.strokeRect(748, 26, 424, 540);

        x.fillStyle = olive;
        x.font = '22px "Special Elite"';
        track(x, t("noticeEyebrow").toUpperCase(), 70, 96, 3.4, "left");
        x.fillStyle = red;
        x.font = '34px "Black Ops One"';
        track(x, t("topFan").toUpperCase(), 70, 168, 5, "left");

        x.fillStyle = olive;
        const size = fit(x, d.name.toUpperCase(), 590, 116, (v) => `${v}px "Black Ops One"`);
        const base = 168 + size * 0.98;
        x.fillText(d.name.toUpperCase(), 70, base);
        x.fillStyle = red;
        x.fillRect(70, base + 28, 270, 7);

        x.fillStyle = olive;
        x.font = '23px "Special Elite"';
        const body = isTied(d)
          ? t("noticeBodyTied", { count: d.count, fans: d.fans })
          : t("noticeBody", { count: d.count, gap: gapOf(d) });
        wrap(x, body.toUpperCase(), 600)
          .slice(0, 4)
          .forEach((line, i) => x.fillText(line, 70, base + 88 + i * 33));

        x.fillStyle = cream;
        x.font = '30px "Black Ops One"';
        track(x, `${t("enlist").toUpperCase()} - ${SITE.toUpperCase()}`, 70, CARD_H - 28, 4, "left");
        x.font = '21px "Special Elite"';
        track(x, t("heldBy", { name: d.holder }).toUpperCase(), CARD_W - 40, CARD_H - 30, 2.2, "right");
      },
      520,
      15
    );
    grain(ctx, 60, 0.16);
  },

  funk(ctx, d, img) {
    const cream = "#F6E7C3";
    const cocoa = "#6B3410";
    ctx.fillStyle = cream;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    rays(ctx, 880, 296, 26, 1500, "#EFA93A", "#DE6C24", 0.13);
    ctx.fillStyle = cream;
    ctx.fillRect(0, CARD_H - 92, CARD_W, 92);

    sticker(ctx, img, 404, 742, 84, 9, cream);
    ctx.drawImage(img, 742, 84, 404, 404);

    ctx.fillStyle = cocoa;
    ctx.font = '38px "Alfa Slab One"';
    track(ctx, t("topFan").toUpperCase(), 68, 130, 4, "left");

    const size = fit(ctx, d.name, 600, 128, (v) => `${v}px "Alfa Slab One"`);
    const base = 148 + size * 0.86;
    ctx.fillStyle = cream;
    ctx.fillText(d.name, 75, base + 7);
    ctx.fillStyle = cocoa;
    ctx.fillText(d.name, 68, base);

    ctx.font = '34px "Alfa Slab One"';
    const brag = t("deep", { count: d.count });
    ctx.fillStyle = cocoa;
    ctx.fillRect(68, base + 32, ctx.measureText(brag).width + 44, 62);
    ctx.fillStyle = cream;
    ctx.fillText(brag, 90, base + 74);

    ctx.fillStyle = cocoa;
    ctx.font = '26px "Alfa Slab One"';
    ctx.fillText(isTied(d) ? t("tiedWith", { n: Math.max(0, d.fans - 1) }) : t("clearOfSecond", { n: gapOf(d) }), 68, base + 138);

    ctx.fillStyle = "#DE6C24";
    ctx.font = '30px "Alfa Slab One"';
    track(ctx, SITE, CARD_W / 2, CARD_H - 36, 3, "center");
    grain(ctx, 50, 0.13);
  },

  agit(ctx, d, img) {
    const bone = "#E6E1D4";
    const red = "#C0261F";
    const ink = "#16150F";
    ctx.fillStyle = bone;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    inky(
      ctx,
      (x) => {
        x.fillStyle = ink;
        x.beginPath();
        x.moveTo(0, 0);
        x.lineTo(560, 0);
        x.lineTo(300, CARD_H);
        x.lineTo(0, CARD_H);
        x.closePath();
        x.fill();
        x.fillStyle = red;
        x.beginPath();
        x.moveTo(560, 0);
        x.lineTo(CARD_W, 0);
        x.lineTo(CARD_W, 250);
        x.lineTo(430, CARD_H);
        x.lineTo(300, CARD_H);
        x.closePath();
        x.fill();

        x.save();
        x.translate(1000, 292);
        x.rotate(-0.14);
        x.drawImage(stencil(img, 470, [ink, red, bone]), -235, -235, 470, 470);
        x.restore();

        x.save();
        x.translate(320, 322);
        x.rotate(-0.14);
        const n = String(d.count);
        const size = fit(x, n, 700, 300, (v) => `${v}px Anton`);
        x.textAlign = "center";
        x.fillStyle = ink;
        x.fillText(n, 10, size * 0.36 + 10);
        x.fillStyle = bone;
        x.fillText(n, 0, size * 0.36);
        x.textAlign = "left";
        x.restore();

        x.fillStyle = bone;
        x.font = '30px Anton';
        track(x, t("boardNo").toUpperCase(), 56, 74, 5, "left");
        x.font = '26px Anton';
        track(x, isTied(d) ? t("fansN", { n: d.fans }).toUpperCase() : `+${t("clear", { n: gapOf(d) }).toUpperCase()}`, 56, 118, 4, "left");

        x.fillStyle = ink;
        x.fillRect(0, CARD_H - 86, CARD_W, 86);
        x.fillStyle = bone;
        x.font = '34px Anton';
        track(x, `${d.name.toUpperCase()} / ${t("firstFan").toUpperCase()} / ${SITE.toUpperCase()}`, 56, CARD_H - 30, 5, "left");
      },
      460,
      13
    );
    grain(ctx, 55, 0.14);
  },

  vhs(ctx, d, img) {
    const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
    g.addColorStop(0, "#0E0722");
    g.addColorStop(0.55, "#2A0B44");
    g.addColorStop(1, "#5B1148");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    for (let i = 0; i < 170; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.14 + Math.random() * 0.6})`;
      ctx.fillRect(Math.random() * CARD_W, Math.random() * 340, 2, 2);
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(880, 300, 196, 0, 7);
    ctx.clip();
    const sun = ctx.createLinearGradient(0, 110, 0, 500);
    sun.addColorStop(0, "#F7C948");
    sun.addColorStop(0.5, "#FF6B3D");
    sun.addColorStop(1, "#FF2E88");
    ctx.fillStyle = sun;
    ctx.fillRect(680, 100, 400, 400);
    ctx.fillStyle = "rgba(14,7,34,0.92)";
    for (let y = 300, k = 2; y < 500; y += 16, k += 1.4) ctx.fillRect(670, y, 420, k);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,46,136,0.5)";
    ctx.lineWidth = 2;
    for (let i = -18; i <= 18; i++) {
      ctx.beginPath();
      ctx.moveTo(880 + i * 34, 452);
      ctx.lineTo(880 + i * 320, CARD_H);
      ctx.stroke();
    }
    for (let y = 452, step = 4; y < CARD_H; step *= 1.44, y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CARD_W, y);
      ctx.stroke();
    }

    const S = 372;
    const X = 694;
    const Y = 116;
    const tv = off(S, S);
    tv.x.globalAlpha = 0.75;
    tv.x.drawImage(tint(img, S, (l) => mix([0, 0, 0], [255, 46, 136], l)), -10, 0, S, S);
    tv.x.globalCompositeOperation = "screen";
    tv.x.drawImage(tint(img, S, (l) => mix([0, 0, 0], [51, 231, 255], l)), 10, 0, S, S);
    tv.x.globalCompositeOperation = "source-over";
    tv.x.globalAlpha = 1;
    tv.x.drawImage(img, 0, 0, S, S);
    for (let i = 0; i < 5; i++) {
      const sy = 30 + Math.random() * (S - 70);
      const sh = 3 + Math.random() * 9;
      tv.x.drawImage(tv.c, 0, sy, S, sh, (Math.random() * 2 - 1) * 16, sy, S, sh);
    }
    ctx.drawImage(tv.c, X, Y, S, S);
    ctx.strokeStyle = "rgba(51,231,255,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeRect(X - 4, Y - 4, S + 8, S + 8);
    ctx.strokeStyle = "rgba(255,46,136,0.55)";
    ctx.strokeRect(X - 9, Y - 9, S + 18, S + 18);

    const chrome = ctx.createLinearGradient(0, 148, 0, 214);
    chrome.addColorStop(0, "#FFFFFF");
    chrome.addColorStop(0.44, "#B9CBE8");
    chrome.addColorStop(0.5, "#4E6D9C");
    chrome.addColorStop(0.56, "#EDF3FF");
    chrome.addColorStop(1, "#8FA6C6");
    const label = t("topFan").toUpperCase();
    ctx.font = '900 56px Orbitron';
    ctx.fillStyle = "rgba(255,46,136,0.85)";
    track(ctx, label, 57, 205, 7, "left");
    ctx.fillStyle = "rgba(51,231,255,0.85)";
    track(ctx, label, 67, 205, 7, "left");
    ctx.fillStyle = chrome;
    track(ctx, label, 62, 205, 7, "left");

    const size = fit(ctx, d.name, 570, 116, (v) => `800 ${v}px Montserrat`);
    const base = 226 + size * 0.92;
    ctx.fillStyle = "rgba(255,46,136,0.9)";
    ctx.fillText(d.name, 56, base + 6);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(d.name, 62, base);

    ctx.font = '900 44px Orbitron';
    ctx.fillStyle = "#33E7FF";
    ctx.fillText(`x${d.count}`, 62, base + 74);

    ctx.font = '700 17px Montserrat';
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    const line = isTied(d) ? t("fansN", { n: d.fans }) : `${t("clear", { n: gapOf(d) })} - ${t("fansN", { n: d.fans })}`;
    track(ctx, line.toUpperCase(), 62, base + 118, 2, "left");
    ctx.fillStyle = "#F7C948";
    track(ctx, SITE.toUpperCase(), 62, CARD_H - 44, 4, "left");
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    track(ctx, d.holder.toUpperCase(), CARD_W - 56, CARD_H - 44, 2, "right");

    scanlines(ctx, 3, 0.14);
    vignette(ctx, 0.5);
    grain(ctx, 40, 0.1);
  },

  foil(ctx, d, img) {
    const rare = RARITY[d.rarity] || "#605BFF";
    const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    g.addColorStop(0, "#171230");
    g.addColorStop(1, "#3E2A5C");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.translate(-120, 0);
    ctx.rotate(0.34);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.018 + (i % 3) * 0.014})`;
      ctx.fillRect(i * 190, -300, 62 + (i % 3) * 40, 1400);
    }
    ctx.restore();

    const glow = ctx.createRadialGradient(320, 316, 20, 320, 316, 300);
    glow.addColorStop(0, `${rare}55`);
    glow.addColorStop(1, `${rare}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(20, 16, 600, 600);
    ctx.drawImage(img, 148, 148, 344, 344);

    ctx.strokeStyle = rare;
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, CARD_W - 48, CARD_H - 48);

    ctx.fillStyle = rare;
    ctx.font = '800 21px Montserrat';
    track(ctx, t("noOneFan").toUpperCase(), 596, 176, 5, "left");

    const size = fit(ctx, d.name, 546, 108, (v) => `800 ${v}px Montserrat`);
    const base = 176 + size * 0.92;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(d.name, 596, base);

    ctx.fillStyle = "#B9B2D8";
    ctx.font = '600 32px Montserrat';
    ctx.fillText(t("copiesN", { n: d.count }), 596, base + 56);

    ctx.font = '700 15px Montserrat';
    const chips = [
      t("level", { n: d.level }),
      t("fansN", { n: d.fans }),
      isTied(d) ? t("tied") : `+${gapOf(d)}`,
      t("sinceYear", { year: d.since }),
    ];
    let cx = 596;
    for (const chip of chips) {
      const w = ctx.measureText(chip).width + 26;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(cx, base + 88, w, 40);
      ctx.fillStyle = "#CFC8E8";
      ctx.fillText(chip, cx + 13, base + 114);
      cx += w + 10;
    }

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = '700 17px Montserrat';
    track(ctx, SITE.toUpperCase(), 596, CARD_H - 76, 4, "left");
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = '700 15px Montserrat';
    track(ctx, d.holder.toUpperCase(), CARD_W - 66, CARD_H - 76, 2, "right");
  },
};

export function drawCard(canvas: HTMLCanvasElement, style: FanCardStyleId, data: FanCardData, img: CanvasImageSource) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  (DRAW[style] || DRAW.pinned)(ctx, data, img);
  ctx.restore();
}

// each style is drawn once into its own canvas, so flicking through the set is a blit
// rather than a redraw
export function renderAll(styles: FanCardStyleId[], data: FanCardData, img: CanvasImageSource) {
  const out = new Map<FanCardStyleId, HTMLCanvasElement>();
  for (const style of styles) {
    const { c } = off(CARD_W, CARD_H);
    drawCard(c, style, data, img);
    out.set(style, c);
  }
  return out;
}
