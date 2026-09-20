import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../../../i18n";
import AvatarMenu from ".";
import { xpSummary } from "./AvatarMenu.services";
import { xpForLevel } from "../../../../utils/levelCurve";
import { User } from "../../../Types";

const user = { id: "u1", username: "Nova Drake", level: 12, xp: xpForLevel(12) + 500, profilePicture: "" } as unknown as User;

const logout = vi.fn();

const draw = () =>
  render(
    <MemoryRouter>
      <AvatarMenu userData={user} loading={false} size="medium" logout={logout} />
    </MemoryRouter>
  );

const trigger = () => screen.getByRole("button", { name: /account menu/i });

beforeEach(async () => {
  vi.clearAllMocks();
  await act(() => i18n.changeLanguage("en"));
});

describe("the avatar menu", () => {
  it("stays closed until the avatar is used", () => {
    draw();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Nova Drake")).toBeTruthy();
    expect(screen.getByText("Level 12")).toBeTruthy();
  });

  it("shows how far the next level is", () => {
    draw();
    fireEvent.click(trigger());
    const { toNext } = xpSummary(user.xp, user.level);
    expect(screen.getByText(`${toNext.toLocaleString("en-US")} XP to level 13`)).toBeTruthy();
  });

  it("logs out from the card and closes", () => {
    draw();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("changes the language from the card", async () => {
    draw();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: /language/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /português/i }));
    });
    expect(i18n.language).toBe("pt");
    expect(screen.getByRole("button", { name: /sair/i })).toBeTruthy();
  });

  it("closes on escape", () => {
    draw();
    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("xpSummary", () => {
  it("measures the level from its own start, not from zero", () => {
    const s = xpSummary(xpForLevel(12), 12);
    expect(s.filled).toBe(0);
    expect(s.toNext).toBe(xpForLevel(13) - xpForLevel(12));
    expect(s.nextLevel).toBe(13);
  });
});
