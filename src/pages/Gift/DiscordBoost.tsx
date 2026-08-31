import { useState } from "react";
import { FaDiscord, FaLock } from "react-icons/fa";
import { startDiscordOAuth } from "../../services/discord/DiscordLinkService";
import BoostCard, { Chip, betterPrizes } from "./BoostCard";
import { gainOf } from "./Gift.services";
import type { GiftDiscordBoost } from "./Gift.types";
import i18n from "../../i18n";

const INVITE = (import.meta.env.VITE_DISCORD_INVITE as string) || "";

// the third lever, and the only one not earned by playing. it states the same kind of
// number the other two do, because a boost nobody can price is not an offer.
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
    <BoostCard
      label={i18n.t("gift.discordBoost")}
      status={
        active ? (
          <Chip tone="live">{i18n.t("gift.discordActive")}</Chip>
        ) : (
          <Chip tone="muted">
            <FaLock className="text-[9px]" />
            {i18n.t("gift.discordLocked")}
          </Chip>
        )
      }
      live={active}
      footValue={gainOf(discord.boost)}
      footNote={active ? betterPrizes() : i18n.t("gift.betterPrizesOnceLinked")}
    >
      {active ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center bg-[#5865F2]">
            <FaDiscord className="text-3xl text-white" />
          </span>
          <span className="text-[13px] text-ink-soft">{i18n.t("gift.discordHeld")}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="flex items-center justify-center gap-2 bg-[#5865F2] py-3 text-sm font-bold text-white hover:bg-[#4752c4] disabled:opacity-60"
          >
            <FaDiscord className="text-lg" />
            {discord.linked ? i18n.t("gift.discordJoinCta") : i18n.t("gift.discordLinkCta")}
          </button>
          <span className="text-[12px] leading-relaxed text-ink-muted">
            {discord.linked ? i18n.t("gift.discordJoinBlurb") : i18n.t("gift.discordLinkBlurb")}
          </span>
        </div>
      )}
    </BoostCard>
  );
};

export default DiscordBoost;
