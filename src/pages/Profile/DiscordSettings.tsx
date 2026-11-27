import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FaDiscord } from "react-icons/fa";
import {
    getDiscordLink,
    unlinkDiscord,
    DiscordLinkState,
} from "../../services/discord/DiscordLinkService";
import { useDiscordConnect } from "../../services/discord/useDiscordConnect";
import SettingsCard from "./SettingsCard";
import i18n from "../../i18n";

// what the backend redirect can come back saying, and which of those read as a failure
const OUTCOMES: Record<string, { key: string; ok: boolean }> = {
    linked: { key: "discord.linkedToast", ok: true },
    joined: { key: "discord.joinedToast", ok: true },
    already: { key: "discord.errAlready", ok: false },
    taken: { key: "discord.errTaken", ok: false },
    young: { key: "discord.errYoung", ok: false },
    expired: { key: "discord.errExpired", ok: false },
    failed: { key: "discord.errFailed", ok: false },
};

const DiscordSettings = () => {
    const [params, setParams] = useSearchParams();
    const [state, setState] = useState<DiscordLinkState | null>(null);
    const [busy, setBusy] = useState(false);
    const { connect, join, busy: connecting, canJoin } = useDiscordConnect();

    useEffect(() => {
        getDiscordLink().then(setState).catch(() => undefined);
    }, []);

    // the oauth round trip lands back on this tab, so the answer is in the url
    useEffect(() => {
        const outcome = params.get("discord");
        if (!outcome) return;
        const found = OUTCOMES[outcome] || OUTCOMES.failed;
        toast[found.ok ? "success" : "error"](i18n.t(found.key), { theme: "dark" });
        params.delete("discord");
        // the outcome is what opened this section, so the url names it once the outcome is gone
        params.set("section", "discord");
        setParams(params, { replace: true });
    }, [params, setParams]);

    const unlink = async () => {
        setBusy(true);
        try {
            await unlinkDiscord();
            setState({ linked: false, discordName: null, linkedAt: null });
            toast.success(i18n.t("discord.unlinked"), { theme: "dark" });
        } catch {
            toast.error(i18n.t("settings.saveFailed"), { theme: "dark" });
        }
        setBusy(false);
    };

    if (!state) return null;
    const outside = state.linked && !state.inGuild;

    return (
        <SettingsCard
            title={i18n.t("discord.settingsTitle")}
            footer={
                <>
                    {outside && canJoin && (
                        <button
                            onClick={join}
                            className="flex items-center gap-2 px-4 h-9 rounded-md border-none bg-[#5865F2] font-semibold text-white transition-colors hover:border-none hover:bg-[#4752c4]"
                        >
                            <FaDiscord /> {i18n.t("gift.discordJoinCta")}
                        </button>
                    )}
                    {state.linked ? (
                        <button
                            onClick={unlink}
                            disabled={busy}
                            className="px-4 h-9 rounded-md border border-line bg-surface-nav font-semibold transition-colors hover:bg-line disabled:opacity-50"
                        >
                            {i18n.t("discord.unlinkButton")}
                        </button>
                    ) : (
                        <button
                            onClick={connect}
                            disabled={connecting}
                            className="flex items-center gap-2 px-4 h-9 rounded-md border-none bg-[#5865F2] font-semibold text-white transition-colors hover:border-none hover:bg-[#4752c4] disabled:opacity-50"
                        >
                            <FaDiscord /> {i18n.t("discord.linkButton")}
                        </button>
                    )}
                </>
            }
        >
            <span className="font-semibold">
                {state.linked
                    ? i18n.t("discord.linkedAs", { name: state.discordName || "Discord" })
                    : i18n.t("discord.notLinked")}
            </span>
        </SettingsCard>
    );
};

export default DiscordSettings;
