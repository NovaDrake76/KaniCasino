import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OnboardingModal from "./OnboardingModal";

describe("OnboardingModal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows on a first visit", () => {
    render(<OnboardingModal />);
    expect(screen.getByText("Welcome to KaniCasino!")).toBeInTheDocument();
    expect(screen.getByText("Start with free coins")).toBeInTheDocument();
  });

  it("does not show again once seen", () => {
    localStorage.setItem("kani.onboardingSeen", "1");
    const { container } = render(<OnboardingModal />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dismissing it marks it as seen", () => {
    render(<OnboardingModal />);
    fireEvent.click(screen.getByText("Got it, let's play!"));
    expect(screen.queryByText("Welcome to KaniCasino!")).toBeNull();
    expect(localStorage.getItem("kani.onboardingSeen")).toBe("1");
  });

  it("closing with the X also marks it as seen", () => {
    render(<OnboardingModal />);
    fireEvent.click(screen.getByLabelText("close modal"));
    expect(screen.queryByText("Welcome to KaniCasino!")).toBeNull();
    expect(localStorage.getItem("kani.onboardingSeen")).toBe("1");
  });
});
