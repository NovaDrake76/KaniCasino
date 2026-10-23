import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { countsAsHere, HERE_EVERY_MS, useHereSignal } from "./useHereSignal";

const sayHere = vi.fn();
vi.mock("../../services/daisu/DaisuService", () => ({
  sayHere: (...args: unknown[]) => sayHere(...args),
}));

const Page = ({ enabled = true }: { enabled?: boolean }) => {
  useHereSignal(enabled);
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/dice")}>dice</button>
      <button type="button" onClick={() => navigate("/plinko")}>plinko</button>
    </>
  );
};

const draw = (enabled = true) =>
  render(
    <MemoryRouter>
      <Page enabled={enabled} />
    </MemoryRouter>
  );

describe("telling the server the player is around", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sayHere.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("counts a real click anywhere but the jar or her question", () => {
    const page = document.createElement("div");
    const jar = document.createElement("button");
    jar.setAttribute("data-tour", "daisu-jar");
    const answer = document.createElement("button");
    answer.setAttribute("data-still-there", "");
    page.append(jar, answer);

    expect(countsAsHere({ isTrusted: true, target: page })).toBe(true);
    expect(countsAsHere({ isTrusted: true, target: jar })).toBe(false);
    expect(countsAsHere({ isTrusted: true, target: answer })).toBe(false);
  });

  it("never counts a click a script made up", () => {
    expect(countsAsHere({ isTrusted: false, target: document.createElement("div") })).toBe(false);
  });

  it("says so on arrival and on a new page, at most once every five minutes", async () => {
    draw();
    expect(sayHere).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("dice"));
    expect(sayHere).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(HERE_EVERY_MS);
    });
    fireEvent.click(screen.getByText("plinko"));
    expect(sayHere).toHaveBeenCalledTimes(2);
  });

  it("stays quiet for an account without her", () => {
    draw(false);
    expect(sayHere).not.toHaveBeenCalled();
  });
});
