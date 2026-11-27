import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import UserContext from "../../UserContext";
import SettingsPanel from "./SettingsPanel";

const getDiscordLink = vi.fn();
vi.mock("../../services/discord/DiscordLinkService", () => ({
  getDiscordLink: () => getDiscordLink(),
  startDiscordOAuth: () => new Promise(() => undefined),
  unlinkDiscord: () => Promise.resolve(),
}));

vi.mock("../../services/email/EmailService", () => ({
  getEmailPreferences: () => Promise.resolve({ marketingOptIn: false, emailSuppressed: false }),
  setMarketingOptIn: () => Promise.resolve({ marketingOptIn: true, emailSuppressed: false }),
}));

const success = vi.fn();
vi.mock("react-toastify", () => ({ toast: { success: (...a: unknown[]) => success(...a), error: vi.fn() } }));

const Address = () => <span data-testid="search">{useLocation().search}</span>;

const draw = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <UserContext.Provider value={{ userData: { username: "Nova Drake", nameChangeAllowedAt: null }, toogleUserData: vi.fn() }}>
        <SettingsPanel />
        <Address />
      </UserContext.Provider>
    </MemoryRouter>
  );

const open = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-current");

beforeEach(() => {
  getDiscordLink.mockReset().mockResolvedValue({ linked: true, discordName: "brenoj", linkedAt: "2026-09-26", inGuild: true });
  success.mockReset();
});

describe("the settings tab", () => {
  it("opens on the account section", () => {
    draw("/profile/me?tab=settings");

    expect(open("Account")).toBe("true");
    expect(screen.getByRole("heading", { name: "Nickname" })).toBeTruthy();
  });

  it("opens the section the link names", () => {
    draw("/profile/me?tab=settings&section=preferences");

    expect(open("Preferences")).toBe("true");
    expect(screen.getByRole("heading", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sound" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Nickname" })).toBeNull();
  });

  it("switches section from the list and keeps it in the url", async () => {
    draw("/profile/me?tab=settings");

    fireEvent.click(screen.getByRole("button", { name: "Email" }));

    expect(await screen.findByRole("switch", { name: /updates about new cases/i })).toBeTruthy();
    expect(screen.getByTestId("search").textContent).toBe("?tab=settings&section=email");
  });

  // the oauth redirect names no section, and its outcome leaves the url once the toast is up
  it("lands a discord link on the discord section and stays there", async () => {
    draw("/profile/me?tab=settings&discord=joined");

    expect(await screen.findByText(/linked as brenoj/i)).toBeTruthy();
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(screen.getByTestId("search").textContent).toBe("?tab=settings&section=discord");
    expect(open("Discord")).toBe("true");
    expect(screen.getByText(/linked as brenoj/i)).toBeTruthy();
  });
});
