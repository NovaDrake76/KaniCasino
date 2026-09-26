import { useState } from "react";
import { toast } from "react-toastify";
import { startDiscordOAuth } from "./DiscordLinkService";
import i18n from "../../i18n";

// the one way into discord from anywhere on the site: a single approval links the account and seats the player in
// the server. an account that is already linked cannot start that again, so it is handed the invite instead
export const useDiscordConnect = () => {
  const [busy, setBusy] = useState(false);
  const invite = (import.meta.env.VITE_DISCORD_INVITE as string) || "";

  const join = () => {
    if (invite) window.open(invite, "_blank", "noopener");
  };

  const connect = async () => {
    setBusy(true);
    try {
      window.location.href = await startDiscordOAuth();
    } catch {
      if (invite) join();
      else toast.error(i18n.t("discord.errFailed"), { theme: "dark" });
      setBusy(false);
    }
  };

  return { connect, join, busy, canJoin: !!invite };
};
