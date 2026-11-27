import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import UserContext from "../../UserContext";
import SkipAnimationSwitch from "./SkipAnimationSwitch";
import { useSkipAnimation } from "./skipAnimation";

// the case page wires the two together the same way
const Controls = ({ busy = false }: { busy?: boolean }) => {
  const skipAnimation = useSkipAnimation();
  return (
    <>
      <SkipAnimationSwitch held={skipAnimation.held} on={skipAnimation.on} onChange={skipAnimation.set} disabled={busy} />
      <output data-testid="skips">{String(skipAnimation.skip)}</output>
    </>
  );
};

const draw = (userData: object | null, busy = false) =>
  render(
    <UserContext.Provider value={{ userData } as never}>
      <Controls busy={busy} />
    </UserContext.Provider>
  );

const holder = { id: "u1", features: { daisu: true }, unlocks: ["stopwatch"] };

describe("the skip animation switch on a case page", () => {
  beforeEach(() => localStorage.clear());

  it("is not there without the stopwatch, whatever this browser stored", () => {
    localStorage.setItem("kani.skipCaseAnimation", "1");

    for (const userData of [{ id: "u1", features: { daisu: true }, unlocks: ["spyglass"] }, { id: "u2", features: {}, unlocks: ["stopwatch"] }, null]) {
      const { unmount } = draw(userData);
      expect(screen.queryByRole("switch")).toBeNull();
      expect(screen.queryByText("Skip animation")).toBeNull();
      expect(screen.getByTestId("skips").textContent).toBe("false");
      unmount();
    }
  });

  it("shows for a holder, off at first, and keeps the choice in this browser", () => {
    draw(holder);
    const toggle = screen.getByRole("switch", { name: "Skip animation" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("skips").textContent).toBe("false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("kani.skipCaseAnimation")).toBe("1");
    expect(screen.getByTestId("skips").textContent).toBe("true");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("kani.skipCaseAnimation")).toBe("0");
  });

  it("starts from what this browser stored", () => {
    localStorage.setItem("kani.skipCaseAnimation", "1");
    draw(holder);
    expect(screen.getByRole("switch", { name: "Skip animation" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("skips").textContent).toBe("true");
  });

  it("cannot be flipped while a case is opening", () => {
    draw(holder, true);
    const toggle = screen.getByRole("switch", { name: "Skip animation" });
    expect(toggle).toBeDisabled();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("kani.skipCaseAnimation")).toBeNull();
  });
});
