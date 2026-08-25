import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OnboardingModal from "./OnboardingModal";

// the tour reads the route to know when to stay out of the way
const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <OnboardingModal />
    </MemoryRouter>
  );

describe("OnboardingModal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows on a first visit", () => {
    at("/");
    expect(screen.getByText("Welcome to KaniCasino!")).toBeInTheDocument();
    expect(screen.getByText("Start with free coins")).toBeInTheDocument();
  });

  it("does not show again once seen", () => {
    localStorage.setItem("kani.onboardingSeen", "1");
    const { container } = at("/");
    expect(container).toBeEmptyDOMElement();
  });

  it("dismissing it marks it as seen", () => {
    at("/");
    fireEvent.click(screen.getByText("Got it, let's play!"));
    expect(screen.queryByText("Welcome to KaniCasino!")).toBeNull();
    expect(localStorage.getItem("kani.onboardingSeen")).toBe("1");
  });

  it("closing with the X also marks it as seen", () => {
    at("/");
    fireEvent.click(screen.getByLabelText("close modal"));
    expect(screen.queryByText("Welcome to KaniCasino!")).toBeNull();
    expect(localStorage.getItem("kani.onboardingSeen")).toBe("1");
  });

  // it used to open on top of the login panel there and swallow every click, which left
  // a visitor arriving from the discord bot unable to finish linking
  it("stays out of the way of the discord link flow", () => {
    const { container } = at("/link/discord?code=ABCD2345");
    expect(container).toBeEmptyDOMElement();
  });

  it("still shows once that visitor reaches the site", () => {
    at("/");
    expect(screen.getByText("Welcome to KaniCasino!")).toBeInTheDocument();
  });
});
