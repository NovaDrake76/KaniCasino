import { PICK, POOL, sortPick } from "./lotteryRules";

// the draw rebuilt in the browser, so checking it trusts nothing the server says about itself: hmac-sha256 keyed by the
// revealed seed over `lottery:<draw>:<cursor>`, four bytes to a float, a partial fisher-yates over 1..20
const encoder = new TextEncoder();

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export const canVerify = () => typeof globalThis.crypto !== "undefined" && !!globalThis.crypto.subtle;

export const sha256Hex = async (text: string) => hex(await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(text)));

export const drawWith = (floats: number[]) => {
  const pool = Array.from({ length: POOL }, (_, i) => i + 1);
  for (let i = 0; i < PICK; i++) {
    const j = i + Math.floor(floats[i] * (POOL - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return sortPick(pool.slice(0, PICK));
};

export async function drawNumbers(serverSeed: string, drawNumber: number) {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey("raw", encoder.encode(serverSeed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const floats = await Promise.all(
    Array.from({ length: PICK }, async (_, cursor) => {
      const sig = new Uint8Array(await subtle.sign("HMAC", key, encoder.encode(`lottery:${drawNumber}:${cursor}`)));
      return sig[0] / 256 + sig[1] / 256 ** 2 + sig[2] / 256 ** 3 + sig[3] / 256 ** 4;
    })
  );
  return drawWith(floats);
}

export interface DrawCheck {
  commitmentValid: boolean;
  outcomeValid: boolean;
  recomputed: number[];
}

export async function checkDraw(draw: { number: number; serverSeed: string; seedHash: string; numbers: number[] }): Promise<DrawCheck> {
  const [hash, recomputed] = await Promise.all([sha256Hex(draw.serverSeed), drawNumbers(draw.serverSeed, draw.number)]);
  return {
    commitmentValid: hash === draw.seedHash,
    outcomeValid: recomputed.join(",") === sortPick(draw.numbers).join(","),
    recomputed,
  };
}
