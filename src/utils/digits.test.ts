import { describe, it, expect } from "vitest";
import { digitsOnly, clampDigits } from "./digits";

describe("digitsOnly", () => {
  it("keeps an empty field empty so a value can be retyped", () => {
    expect(digitsOnly("")).toBe("");
  });

  it("drops anything that is not a digit and caps the length", () => {
    expect(digitsOnly("1e-2.5")).toBe("125");
    expect(digitsOnly("123456789", 3)).toBe("123");
  });
});

describe("clampDigits", () => {
  it("falls back when the field was left empty", () => {
    expect(clampDigits("", 1, 20, 1)).toBe(1);
  });

  it("holds the typed number inside the bounds", () => {
    expect(clampDigits("0", 1, 20)).toBe(1);
    expect(clampDigits("50", 1, 20)).toBe(20);
    expect(clampDigits("7", 1, 20)).toBe(7);
  });
});
