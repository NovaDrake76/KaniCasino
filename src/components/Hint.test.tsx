import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import Hint from "./Hint";

// A hint that comes back after a player has closed it is a nag, and a hint stored under
// the wrong key follows the wrong account. Both are quiet failures until somebody
// complains, so they are pinned here rather than trusted.
beforeEach(() => localStorage.clear());

describe("a hint", () => {
  it("shows only while the caller says it is relevant", () => {
    const { rerender } = render(<Hint id="wear-badge" userId="u1" text="Pick one to wear." show />);
    expect(screen.getByText("Pick one to wear.")).toBeTruthy();

    rerender(<Hint id="wear-badge" userId="u1" text="Pick one to wear." show={false} />);
    expect(screen.queryByText("Pick one to wear.")).toBeNull();
  });

  it("stays gone once closed, even though the condition still holds", () => {
    const { unmount } = render(<Hint id="wear-badge" userId="u1" text="Pick one." show />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Pick one.")).toBeNull();

    unmount();
    render(<Hint id="wear-badge" userId="u1" text="Pick one." show />);
    expect(screen.queryByText("Pick one.")).toBeNull();
  });

  it("keeps one player's dismissals off another's account", () => {
    render(<Hint id="wear-badge" userId="u1" text="Pick one." show />);
    fireEvent.click(screen.getByRole("button"));

    render(<Hint id="wear-badge" userId="u2" text="Pick one." show />);
    expect(screen.getByText("Pick one.")).toBeTruthy();
  });

  it("keeps one hint's dismissal off another hint", () => {
    render(<Hint id="wear-badge" userId="u1" text="Wear it." show />);
    fireEvent.click(screen.getByRole("button"));

    render(<Hint id="open-case" userId="u1" text="Open one." show />);
    expect(screen.getByText("Open one.")).toBeTruthy();
  });

  // storage is blocked in some browsers and the profile must still render
  it("survives storage it cannot read or write", () => {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });

    render(<Hint id="wear-badge" userId="u1" text="Pick one." show />);
    expect(screen.getByText("Pick one.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Pick one.")).toBeNull();

    if (real) Object.defineProperty(window, "localStorage", real);
  });
});
