import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getEmailPreferences, setMarketingOptIn } from "../../services/email/EmailService";
import LanguageSelector from "../../components/LanguageSelector";
import DiscordSettings from "./DiscordSettings";
import i18n from "../../i18n";

const EmailSettings = () => {
    const [optIn, setOptIn] = useState(false);
    const [suppressed, setSuppressed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getEmailPreferences()
            .then((p) => {
                setOptIn(p.marketingOptIn);
                setSuppressed(p.emailSuppressed);
            })
            .catch(() => undefined)
            .finally(() => setLoading(false));
    }, []);

    const toggle = async () => {
        const next = !optIn;
        setSaving(true);
        setOptIn(next);
        try {
            await setMarketingOptIn(next);
            toast.success(next ? i18n.t("profile.youWillGetUpdates") : i18n.t("profile.updatesTurnedOff"), {
                theme: "dark",
            });
        } catch {
            setOptIn(!next);
            toast.error(i18n.t("settings.saveFailed"), { theme: "dark" });
        }
        setSaving(false);
    };

    if (loading) return <span className="text-ink-muted text-sm">{i18n.t("common.loading")}</span>;

    return (
        <div className="w-full max-w-2xl flex flex-col gap-4">
            <span className="text-lg font-bold">{i18n.t("settings.language")}</span>

            <div className="flex flex-col gap-2 bg-surface border border-line rounded-lg p-4">
                <LanguageSelector />
                <span className="text-sm text-ink-muted">{i18n.t("settings.languageHint")}</span>
            </div>

            <DiscordSettings />

            <span className="text-lg font-bold">{i18n.t("auth.emailShort")}</span>

            <div className="flex items-start justify-between gap-4 bg-surface border border-line rounded-lg p-4">
                <div className="flex flex-col gap-1">
                    <span className="font-semibold">{i18n.t("settings.updates")}</span>
                    <span className="text-sm text-ink-muted">
                        {i18n.t("profile.occasionalEmailWhenSomething")}
                    </span>
                </div>
                <button
                    role="switch"
                    aria-checked={optIn}
                    aria-label={i18n.t("settings.updates")}
                    onClick={toggle}
                    disabled={saving}
                    className={`relative w-12 h-6 shrink-0 rounded-full border border-line transition-colors disabled:opacity-50 ${
                        optIn ? "bg-accent" : "bg-surface-nav"
                    }`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            optIn ? "translate-x-6" : ""
                        }`}
                    />
                </button>
            </div>

            <p className="text-sm text-ink-muted">
                {i18n.t("profile.serviceMessagesAboutYour")}
            </p>

            {suppressed && (
                <p className="text-sm text-red-400">
                    {i18n.t("profile.weAreNotSending")}
                </p>
            )}
        </div>
    );
};

export default EmailSettings;
