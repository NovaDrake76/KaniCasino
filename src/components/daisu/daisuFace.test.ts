import { describe, it, expect } from "vitest";
import { BY_GROUP, BY_LINE, EXPRESSIONS, expressionFor, jarStage } from "./daisuFace";
import en from "../../i18n/locales/en.json";

const groups = en.daisu.lines as unknown as Record<string, Record<string, string>>;

describe("the face a line wears", () => {
  it("takes its group's face", () => {
    expect(expressionFor("daisu.lines.poke0.0")).toBe("sharp");
    expect(expressionFor("daisu.lines.gift.0")).toBe("smug");
  });

  it("lets a line overrule its group", () => {
    expect(BY_GROUP.poke0).toBe("sharp");
    expect(expressionFor("daisu.lines.poke0.2")).toBe("smug");
  });

  it("falls back to the neutral face", () => {
    expect(expressionFor(null)).toBe("default");
    expect(expressionFor("daisu.lines.nosuchgroup.0")).toBe("default");
  });

  // a group added to the copy and not here would quietly wear the neutral face forever
  it("covers every group of lines she has", () => {
    expect(Object.keys(groups).filter((g) => !BY_GROUP[g])).toEqual([]);
  });

  // the copy is indexed by position, so a line map entry can outlive the line it named
  it("only names lines that exist", () => {
    const missing = Object.keys(BY_LINE).filter((key) => {
      const [group, index] = key.split(".");
      return !groups[group] || groups[group][index] === undefined;
    });
    expect(missing).toEqual([]);
  });

  // a take from the jar is the player's reward, so she does not gloat over any of it
  it("never wears the smug face for a take from the jar", () => {
    for (const group of ["filling", "claimed", "claimedCredit"]) {
      for (const index of Object.keys(groups[group])) {
        expect(expressionFor(`daisu.lines.${group}.${index}`)).not.toBe("smug");
      }
    }
  });

  it("gives every expression a drawing to rest on and one to talk with", () => {
    for (const look of Object.values(EXPRESSIONS)) {
      expect(look.rest).toBeTruthy();
      expect(look.talk.length).toBeGreaterThan(0);
    }
  });
});

describe("which jar she holds", () => {
  it("is full only when the pot is", () => {
    expect(jarStage(0.999)).toBe(3);
    expect(jarStage(1)).toBe(4);
    expect(jarStage(2)).toBe(4);
  });

  // a pot that has only just started refilling still reads as empty, which is the drawing for it
  it("gives each drawing a quarter of the cycle", () => {
    expect(jarStage(0)).toBe(0);
    expect(jarStage(0.24)).toBe(0);
    expect(jarStage(0.25)).toBe(1);
    expect(jarStage(0.5)).toBe(2);
    expect(jarStage(0.75)).toBe(3);
  });

  it("never falls off either end", () => {
    for (const fill of [-1, 0, 0.5, 1, 4, NaN]) {
      const stage = jarStage(fill);
      expect(stage).toBeGreaterThanOrEqual(0);
      expect(stage).toBeLessThanOrEqual(4);
    }
  });
});
