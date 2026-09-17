import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TourBubble from "./TourBubble";

// jsdom lays nothing out: the bubble measures 0 tall in a 1024 by 768 window
const rect = { top: 400, left: 100, width: 40, height: 40 };
const bubble = () => screen.getByRole("dialog", { name: /help · pin a character/i });

describe("her bubble", () => {
  it("sits beside what it points at, its top set by the target alone so a longer line grows it downward", () => {
    render(<TourBubble rect={rect} eyebrow="Help · Pin a character" line="See the hearts?" />);

    expect(bubble().style.left).toBe("156px");
    expect(bubble().style.top).toBe("330px");
  });

  it("goes above it when asked, so the row it points at stays in view", () => {
    render(<TourBubble rect={rect} eyebrow="Help · Pin a character" line="See the hearts?" prefer="above" />);

    expect(bubble().style.left).toBe("12px");
    expect(bubble().style.bottom).toBe("384px");
    expect(bubble().style.top).toBe("");
  });

  it("has no buttons unless it is given a way on or a way out", () => {
    render(<TourBubble rect={null} eyebrow="Help · Pin a character" line="See the hearts?" />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
