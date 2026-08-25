import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
    getDiscordLink,
    startDiscordOAuth,
    unlinkDiscord,
    DiscordLinkState,
} from "../../services/discord/DiscordLinkService";
import i18n from "../../i18n";

// what the backend redirect can come back saying, and which of those read as a failure
const OUTCOMES: Record<string, { key: string; ok: boolean }> = {
    linked: { key: "discord.linkedToast", ok: true },
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
        setParams(params, { replace: true });
    }, [params, setParams]);

    const link = async () => {
        setBusy(true);
        try {
            window.location.href = await startDiscordOAuth();
        } catch {
            toast.error(i18n.t("discord.errFailed"), { theme: "dark" });
            setBusy(false);
        }
    };

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

    return (
        <>
            <span className="text-lg font-bold">{i18n.t("discord.settingsTitle")}</span>

            <div className="flex items-start justify-between gap-4 bg-surface border border-line rounded-lg p-4">
                <div className="flex flex-col gap-1">
                    <span className="font-semibold">
                        {state.linked
                            ? i18n.t("discord.linkedAs", { name: state.discordName || "Discord" })
                            : i18n.t("discord.notLinked")}
                    </span>
                    <span className="text-sm text-ink-muted">{i18n.t("discord.linkHint")}</span>
                </div>
                <button
                    onClick={state.linked ? unlink : link}
                    disabled={busy}
                    className="shrink-0 px-4 h-9 rounded-md border border-line bg-surface-nav font-semibold transition-colors hover:bg-line disabled:opacity-50"
                >
                    {state.linked ? i18n.t("discord.unlinkButton") : i18n.t("discord.linkButton")}
                </button>
            </div>
        </>
    );
};

export default DiscordSettings;
