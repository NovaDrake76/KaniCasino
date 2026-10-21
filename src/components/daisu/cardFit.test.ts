import { describe, it, expect } from "vitest";
import { cardZoom } from "./cardFit";

describe("how big her card is drawn", () => {
  it("stays full size on a 1080p screen at 100%", () => {
    expect(cardZoom(950)).toBe(1);
  });

  it("shrinks to the room under the navbar at 150% zoom", () => {
    expect(cardZoom(633)).toBeCloseTo(0.76, 2);
  });

  it("stops shrinking where her text would get too small to read", () => {
    expect(cardZoom(400)).toBe(0.65);
  });
});
