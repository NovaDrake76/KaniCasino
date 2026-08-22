import { getArt } from "../../services/items/ItemService";

// the display faces are only ever drawn into a canvas, and canvas use does not pull a
// @font-face down: they are requested here, the first time a card sheet opens.
const FACES = [
  '32px "Black Ops One"',
  '32px "Special Elite"',
  '32px "Alfa Slab One"',
  '32px Anton',
  '900 32px Orbitron',
  '800 32px Montserrat',
];

let fonts: Promise<unknown> | null = null;

export function loadCardFonts() {
  if (!fonts) {
    fonts = Promise.all(FACES.map((face) => document.fonts.load(face).catch(() => undefined)));
  }
  return fonts;
}

// only our own bucket carries a cors policy. two thirds of the catalog sits on steam's
// cdn, which does not, so that art has to arrive through the api instead.
const OWN_BUCKET = /^kanicases\.s3[.-]/;

const hostOf = (src: string) => {
  try {
    return new URL(src, window.location.href).host;
  } catch {
    return "";
  }
};

export const needsProxy = (src: string) => !OWN_BUCKET.test(hostOf(src));

function loadImage(src: string, cors: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the character art"));
    img.src = src;
  });
}

// crossOrigin is what keeps the canvas exportable, and a blob from our own api is
// same-origin, so neither route taints it.
export async function loadCardArt(src: string) {
  if (!needsProxy(src)) return loadImage(src, true);

  const objectUrl = URL.createObjectURL(await getArt(src));
  try {
    const img = await loadImage(objectUrl, false);
    await img.decode().catch(() => undefined);
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
