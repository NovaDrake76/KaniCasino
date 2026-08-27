import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The upgrade screen quotes the success rate before the player commits, and it computes that
// from its own copy of the backend's constants. Two copies of a number is a lie waiting to
// happen: the quoted rate and the rolled rate would drift apart silently, and the only
// symptom would be players insisting the wheel is rigged. So the copies are compared here.
const read = (...parts: string[]) => readFileSync(join(__dirname, ...parts), "utf8");

const table = (source: string, name: string) => {
  const m = source.match(new RegExp(`${name}(?::[^=]*)? = (\\{[^}]*\\})`));
  if (!m) throw new Error(`could not find ${name}`);
  // both files already write the keys quoted, so the literal is valid JSON as it stands
  return JSON.parse(m[1]);
};

const backend = read("..", "..", "..", "backend", "games", "upgrade.js");
const frontend = read("Items.tsx");

describe("the upgrade constants on both sides", () => {
  it("quote the same return per rarity", () => {
    expect(table(frontend, "UPGRADE_RTP_BY_RARITY")).toEqual(table(backend, "UPGRADE_RTP_BY_RARITY"));
  });

  it("quote the same ceiling per rarity", () => {
    expect(table(frontend, "UPGRADE_CEILING")).toEqual(table(backend, "UPGRADE_CEILING"));
  });

  it("agree on how far above its rarity an item may be staked", () => {
    const gapOf = (source: string) => {
      const m = source.match(/UPGRADE_MAX_RARITY_GAP\s*=\s*(\d+)/);
      if (!m) throw new Error("could not find UPGRADE_MAX_RARITY_GAP");
      return Number(m[1]);
    };
    expect(gapOf(frontend)).toBe(gapOf(backend));
  });

  // the two numbers this change was actually about, spelled out so a silent revert fails
  it("hold the legendary return at 0.3 and the gap at 2", () => {
    expect(table(backend, "UPGRADE_RTP_BY_RARITY")["5"]).toBe(0.3);
    expect(read("..", "..", "..", "backend", "games", "upgrade.js")).toContain("UPGRADE_MAX_RARITY_GAP = 2");
  });
});
