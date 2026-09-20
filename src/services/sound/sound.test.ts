import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SOUND_EVENTS, SOUND_DEFAULTS } from "./events";

const soundsDir = path.resolve(__dirname, "../../../public/sounds");
const manifest = JSON.parse(fs.readFileSync(path.join(soundsDir, "manifest.json"), "utf8")).events as Record<string, string[]>;
const known = SOUND_EVENTS as readonly string[];

describe("sound manifest", () => {
  // a slot with no file is fine and stays silent; a missing slot or a typo is not
  it("has a slot for every event and nothing else", () => {
    expect(SOUND_EVENTS.filter((ev) => !Array.isArray(manifest[ev]))).toEqual([]);
    expect(Object.keys(manifest).filter((ev) => !known.includes(ev))).toEqual([]);
  });

  it("only lists files that exist", () => {
    const missing = Object.values(manifest).flat().filter((f) => !fs.existsSync(path.join(soundsDir, f)));
    expect(missing).toEqual([]);
  });

  it("defaults only reference known events", () => {
    expect(Object.keys(SOUND_DEFAULTS).filter((ev) => !known.includes(ev))).toEqual([]);
  });
});
