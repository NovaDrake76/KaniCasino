import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CategoryBar from "./CategoryBar";

const sections = [
  { id: "top-cases", label: "Most Opened" },
  { id: "cases-touhou", label: "Touhou" },
];

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  document.body.innerHTML = "";
  for (const section of sections) {
    const node = document.createElement("section");
    node.id = section.id;
    node.scrollIntoView = scrollIntoView;
    document.body.appendChild(node);
  }
});

describe("the category bar", () => {
  it("scrolls to the shelf behind the chip", () => {
    render(<CategoryBar sections={sections} />);

    fireEvent.click(screen.getByText("Touhou"));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("marks the clicked chip as the one being read", () => {
    render(<CategoryBar sections={sections} />);

    fireEvent.click(screen.getByText("Touhou"));

    expect(screen.getByText("Touhou").getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("Most Opened").getAttribute("aria-current")).toBeNull();
  });

  it("does nothing when the shelf is not on the page", () => {
    render(<CategoryBar sections={[{ id: "cases-missing", label: "Gone" }]} />);

    fireEvent.click(screen.getByText("Gone"));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  // a home page that failed to load its cases must not leave an empty strip pinned to the top
  it("renders nothing once loading is done and there are no shelves", () => {
    const { container } = render(<CategoryBar sections={[]} />);
    expect(container.querySelector("nav")).toBeNull();
  });

  it("holds the strip open while the cases are still loading", () => {
    const { container } = render(<CategoryBar sections={[]} loading />);
    expect(container.querySelector("nav")).toBeTruthy();
  });
});
