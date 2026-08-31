import { useState } from "react";
import { FaDiscord } from "react-icons/fa";
import { startDiscordOAuth } from "../../services/discord/DiscordLinkService";
import { boost } from "./Gift.services";
import type { GiftDiscordBoost } from "./Gift.types";
import i18n from "../../i18n";

const INVITE = (import.meta.env.VITE_DISCORD_INVITE as string) || "";

// the third panel. the other two are earned by playing, this one is not, so it states the
// same number they do rather than a vaguer promise: what the boost is worth where they stand.
const DiscordBoost = ({ discord }: { discord: GiftDiscordBoost }) => {
  const [busy, setBusy] = useState(false);
  const active = discord.linked && discord.inGuild;

  const connect = async () => {
    setBusy(true);
    try {
      window.location.href = await startDiscordOAuth();
    } catch {
      // linking not configured, or the session is gone: the invite still gets them there
      if (INVITE) window.open(INVITE, "_blank", "noopener");
      setBusy(false);
    }
  };

  return (
    <div className="notched flex flex-col gap-4 bg-surface p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          {i18n.t("gift.discordBoost")}
        </span>
        <span className="text-[11px] text-ink-faint">
          {active ? (
            <b className="text-accent-gold">{i18n.t("gift.discordActive")}</b>
          ) : (
            i18n.t("gift.discordLocked")
          )}
        </span>
      </div>

      <div className="flex items-end gap-3">
        <span
          className={`text-4xl font-extrabold leading-none ${active ? "text-accent-gold" : "text-ink-faint"}`}
        >
          +{boost(discord.boost)}
        </span>
        <span className="pb-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {i18n.t("gift.rarePrizesLikelier")}
        </span>
      </div>

      {active ? (
        <span className="text-[13px] text-ink-muted">{i18n.t("gift.discordHeld")}</span>
      ) : (
        <>
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-[#5865F2] py-2.5 text-sm font-bold text-white hover:bg-[#4752c4] disabled:opacity-60"
          >
            <FaDiscord className="text-lg" />
            {discord.linked ? i18n.t("gift.discordJoinCta") : i18n.t("gift.discordLinkCta")}
          </button>
          <span className="text-[13px] text-ink-muted">
            {discord.linked ? i18n.t("gift.discordJoinBlurb") : i18n.t("gift.discordLinkBlurb")}
          </span>
        </>
      )}
    </div>
  );
};

export default DiscordBoost;
