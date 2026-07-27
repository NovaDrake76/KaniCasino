// the public server widget. no auth and no api key: this is discord's own endpoint,
// not ours, so it does not go through the axios instance.
const WIDGET = "https://discord.com/api/guilds";

export interface DiscordMember {
  id: string;
  username: string;
  status: "online" | "idle" | "dnd" | "offline";
  avatar_url: string | null;
}

export interface DiscordWidget {
  name: string;
  instant_invite: string | null;
  presence_count: number;
  members: DiscordMember[];
}

// returns null rather than throwing: the widget is decoration, and a discord outage
// must not take a section of the home page with it
export async function getDiscordWidget(guildId: string): Promise<DiscordWidget | null> {
  try {
    const res = await fetch(`${WIDGET}/${guildId}/widget.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name,
      instant_invite: data.instant_invite || null,
      presence_count: data.presence_count ?? (data.members?.length || 0),
      members: Array.isArray(data.members) ? data.members : [],
    };
  } catch {
    return null;
  }
}
