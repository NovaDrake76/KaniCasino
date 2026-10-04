import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LimitedBanner from "./LimitedBanner";
import UserContext from "../../UserContext";

const renderFor = (userData: unknown) =>
  render(
    <UserContext.Provider value={{ userData } as never}>
      <LimitedBanner shift={0} />
    </UserContext.Provider>
  );

describe("the limited account banner", () => {
  it("says nothing to a guest or an account in good standing", () => {
    renderFor(null);
    expect(screen.queryByTestId("limited-banner")).toBeNull();
    renderFor({ id: "me", limited: null });
    expect(screen.queryByTestId("limited-banner")).toBeNull();
  });

  it("tells a limited player the reason staff gave", () => {
    renderFor({ id: "me", limited: { at: "2026-10-04T12:00:00Z", reason: "Several accounts feeding one market" } });
    expect(screen.getByTestId("limited-banner").textContent).toContain("Several accounts feeding one market");
  });
});
