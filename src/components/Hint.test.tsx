import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import Hint from "./Hint";

// Shown once, on the first visit after the player earned something. The failure modes are
// quiet in both directions: a hint that comes back is a nag, and one that never re-arms
// means the second badge is never mentioned. Both are pinned here.
beforeEach(() => localStorage.clear());

const shelf = (token: string, show = true) => (
  <Hint id="wear-badge" userId="u1" text="Pick one to wear." show={show} token={token} />
);

describe("a hint", () => {
  it("shows on the first visit and never again for the same thing", () => {
    const first = render(shelf("contributor"));
    expect(screen.getByText("Pick one to wear.")).toBeTruthy();
    first.unmount();

    render(shelf("contributor"));
    expect(screen.queryByText("Pick one to wear.")).toBeNull();
  });

  it("comes back once when the player earns another", () => {
    render(shelf("contributor")).unmount();

    render(shelf("connected,contributor"));
    expect(screen.getByText("Pick one to wear.")).toBeTruthy();
  });

  it("stays away while the caller says it is not relevant, and is not spent either", () => {
    render(shelf("contributor", false)).unmount();
    expect(screen.queryByText("Pick one to wear.")).toBeNull();

    render(shelf("contributor", true));
    expect(screen.getByText("Pick one to wear.")).toBeTruthy();
  });

  it("closes on the button and does not return", () => {
    const open = render(shelf("contributor"));
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Pick one to wear.")).toBeNull();
    open.unmount();

    render(shelf("contributor"));
    expect(screen.queryByText("Pick one to wear.")).toBeNull();
  });

  it("keeps one player's history off another's account", () => {
    render(<Hint id="wear-badge" userId="u1" text="Pick one." show token="a" />).unmount();

    render(<Hint id="wear-badge" userId="u2" text="Pick one." show token="a" />);
    expect(screen.getByText("Pick one.")).toBeTruthy();
  });

  it("keeps one hint's history off another hint", () => {
    render(<Hint id="wear-badge" userId="u1" text="Wear it." show token="a" />).unmount();

    render(<Hint id="open-case" userId="u1" text="Open one." show token="a" />);
    expect(screen.getByText("Open one.")).toBeTruthy();
  });

  // storage is blocked in some browsers, and the profile has to render either way. it
  // cannot be remembered there, so it shows again rather than never showing at all.
  it("survives storage it cannot read or write", () => {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });

    render(shelf("contributor"));
    expect(screen.getByText("Pick one to wear.")).toBeTruthy();

    if (real) Object.defineProperty(window, "localStorage", real);
  });
});
