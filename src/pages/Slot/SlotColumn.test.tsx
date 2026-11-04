import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SlotColumn from "./SlotColumn";

const draw = (symbols: string[], isSpinning: boolean) => <SlotColumn symbols={symbols} isSpinning={isSpinning} position={0} />;
const strip = (container: HTMLElement) => Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("alt"));
const reel = (container: HTMLElement) => container.querySelector(".overflow-hidden > div") as HTMLDivElement;

describe("a slot reel", () => {
  // the strip used to open on random fillers, so the symbols on screen swapped the moment a spin began
  it("starts a spin from the symbols on screen and lands on the new ones", () => {
    const { container, rerender } = render(draw(["red", "blue", "green"], false));
    expect(strip(container)).toHaveLength(50);
    expect(strip(container).slice(-3)).toEqual(["red", "blue", "green"]);

    rerender(draw(["wild", "hakkero", "wild"], true));
    expect(strip(container).slice(0, 3)).toEqual(["red", "blue", "green"]);
    expect(strip(container).slice(-3)).toEqual(["wild", "hakkero", "wild"]);
    expect(reel(container).style.animation).toMatch(/spin/);

    rerender(draw(["wild", "hakkero", "wild"], false));
    expect(strip(container).slice(0, 3)).toEqual(["wild", "hakkero", "wild"]);
    expect(reel(container).style.animation).toBe("");
  });

  it("keeps the same fillers from one spin to the next", () => {
    const { container, rerender } = render(draw(["red", "red", "red"], false));
    const before = strip(container).slice(3, 47);
    rerender(draw(["blue", "blue", "blue"], true));
    rerender(draw(["blue", "blue", "blue"], false));
    expect(strip(container).slice(3, 47)).toEqual(before);
  });
});
