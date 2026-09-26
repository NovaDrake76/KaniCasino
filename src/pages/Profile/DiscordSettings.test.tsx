import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DiscordSettings from "./DiscordSettings";

const getDiscordLink = vi.fn();
const startDiscordOAuth = vi.fn();
vi.mock("../../services/discord/DiscordLinkService", () => ({
  getDiscordLink: () => getDiscordLink(),
  startDiscordOAuth: () => startDiscordOAuth(),
  unlinkDiscord: () => Promise.resolve(),
}));

const success = vi.fn();
const error = vi.fn();
vi.mock("react-toastify", () => ({ toast: { success: (...a: unknown[]) => success(...a), error: (...a: unknown[]) => error(...a) } }));

const draw = (url = "/profile/me?tab=settings") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <DiscordSettings />
    </MemoryRouter>
  );

describe("the discord panel in settings", () => {
  beforeEach(() => {
    getDiscordLink.mockReset();
    startDiscordOAuth.mockReset().mockReturnValue(new Promise(() => undefined));
    success.mockReset();
    error.mockReset();
    vi.stubEnv("VITE_DISCORD_INVITE", "https://discord.gg/kani");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("links through the same one-approval flow the daily gift uses", async () => {
    getDiscordLink.mockResolvedValue({ linked: false, discordName: null, linkedAt: null, inGuild: false });
    draw();

    fireEvent.click(await screen.findByRole("button", { name: /link discord/i }));

    expect(startDiscordOAuth).toHaveBeenCalledTimes(1);
  });

  // the link used to leave a player outside the server with nothing here to get them in
  it("offers the server to a linked player who is not in it", async () => {
    getDiscordLink.mockResolvedValue({ linked: true, discordName: "brenoj", linkedAt: "2026-09-26", inGuild: false });
    const opened = vi.spyOn(window, "open").mockImplementation(() => null);
    draw();

    fireEvent.click(await screen.findByRole("button", { name: /join the server/i }));

    expect(opened).toHaveBeenCalledWith("https://discord.gg/kani", "_blank", "noopener");
    expect(screen.getByRole("button", { name: /unlink/i })).toBeTruthy();
    opened.mockRestore();
  });

  it("offers nothing more once the player is in the server", async () => {
    getDiscordLink.mockResolvedValue({ linked: true, discordName: "brenoj", linkedAt: "2026-09-26", inGuild: true });
    draw();

    expect(await screen.findByRole("button", { name: /unlink/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /join the server/i })).toBeNull();
  });

  // a link that also seated them comes back as "joined", which used to read as a failure
  it("reads a link that seated the player as a success", async () => {
    getDiscordLink.mockResolvedValue({ linked: true, discordName: "brenoj", linkedAt: "2026-09-26", inGuild: true });
    draw("/profile/me?tab=settings&discord=joined");

    await waitFor(() => expect(success).toHaveBeenCalledWith(expect.stringMatching(/in the kanicasino server/i), expect.anything()));
    expect(error).not.toHaveBeenCalled();
  });
});
