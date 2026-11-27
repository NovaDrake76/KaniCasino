export type Tab = "inventory" | "collections" | "history" | "missions" | "affiliates" | "predictions" | "settings";

// the url is the source of truth for the tab. owner-only tabs collapse to inventory
// whenever isOwner is false, which covers both "not the owner" and "ownership not
// known yet", so a slow /users/me can never leak them.
export const resolveTab = (param: string | null, isOwner: boolean): Tab =>
  param === "collections"
    ? "collections"
    : (param === "missions" || param === "history" || param === "affiliates" || param === "predictions" || param === "settings") && isOwner
    ? param
    : "inventory";

export type SettingsSection = "account" | "preferences" | "discord" | "email";

export const SETTINGS_SECTIONS: SettingsSection[] = ["account", "preferences", "discord", "email"];

// the discord oauth redirect lands on the settings tab with only its outcome, so that opens discord
export const resolveSection = (param: string | null, discordOutcome: boolean): SettingsSection =>
  discordOutcome
    ? "discord"
    : SETTINGS_SECTIONS.includes(param as SettingsSection)
    ? (param as SettingsSection)
    : "account";
