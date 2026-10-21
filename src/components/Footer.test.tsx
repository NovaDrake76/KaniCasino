import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Footer from "./Footer";
import UserContext from "../UserContext";
import { DAISU_STAGE_EVENT, ONBOARDING_OPEN_EVENT } from "./daisu/tour/tourEvents";

const replayTour = vi.fn();
vi.mock("./daisu/tour/tourStore", () => ({ replayTour: () => replayTour() }));

const draw = (userData: Record<string, unknown> | null) =>
  render(
    <UserContext.Provider value={{ userData } as never}>
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    </UserContext.Provider>
  );

describe("the footer's onboarding link", () => {
  beforeEach(() => replayTour.mockReset());

  it("takes a signed-in player through daisu's tour again, from her bubble", () => {
    const stages: unknown[] = [];
    const onStage = (e: Event) => stages.push((e as CustomEvent).detail);
    window.addEventListener(DAISU_STAGE_EVENT, onStage);
    draw({ id: "u1", features: { daisu: true } });

    fireEvent.click(screen.getByText("Onboarding"));
    window.removeEventListener(DAISU_STAGE_EVENT, onStage);

    expect(replayTour).toHaveBeenCalledTimes(1);
    expect(stages).toEqual(["bubble"]);
  });

  it("shows a visitor the welcome again", () => {
    const opened = vi.fn();
    window.addEventListener(ONBOARDING_OPEN_EVENT, opened);
    draw(null);

    fireEvent.click(screen.getByText("Onboarding"));
    window.removeEventListener(ONBOARDING_OPEN_EVENT, opened);

    expect(opened).toHaveBeenCalledTimes(1);
    expect(replayTour).not.toHaveBeenCalled();
  });
});
