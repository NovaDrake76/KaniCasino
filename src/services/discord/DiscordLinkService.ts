import api from "../api";

export interface DiscordLinkState {
    linked: boolean;
    discordName: string | null;
    linkedAt: string | null;
}

export const completeDiscordLink = async (code: string): Promise<{ username: string; discordName: string | null }> => {
    const { data } = await api.post("/discord/link/complete", { code });
    return data;
};

export const getDiscordLink = async (): Promise<DiscordLinkState> => {
    const { data } = await api.get("/discord/link/me");
    return data;
};

// discord is the only thing that can say which account a browser belongs to, so linking
// from the site means sending the player there and back
export const startDiscordOAuth = async (): Promise<string> => {
    const { data } = await api.get("/discord/oauth/start");
    return data.url;
};

export const unlinkDiscord = async (): Promise<void> => {
    await api.delete("/discord/link");
};

// the code arrives before the login does, so it waits here while the visitor signs in
const PENDING = "discord:pendingCode";

export const setPendingDiscordCode = (code: string) => sessionStorage.setItem(PENDING, code);

export const takePendingDiscordCode = (): string | null => {
    const code = sessionStorage.getItem(PENDING);
    if (code) sessionStorage.removeItem(PENDING);
    return code;
};
