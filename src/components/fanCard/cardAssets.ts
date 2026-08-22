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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the character art"));
    img.src = src;
  });
}

// every card image comes through our own origin as a blob, so the canvas is never
// tainted and no cors header on anyone else's host has to be right for this to work.
export async function loadCardArt(src: string) {
  const objectUrl = URL.createObjectURL(await getArt(src));
  try {
    const img = await loadImage(objectUrl);
    await img.decode().catch(() => undefined);
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
