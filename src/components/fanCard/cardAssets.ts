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

// crossOrigin is what keeps the canvas exportable. without the header on the bucket the
// image fails outright, which the sheet reports rather than hand back an unsaveable card.
export function loadCardArt(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the character art"));
    img.src = src;
  });
}
