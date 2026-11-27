import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getEmailPreferences, setMarketingOptIn } from "../../services/email/EmailService";
import SettingsCard from "./SettingsCard";
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

    return (
        <SettingsCard title={i18n.t("auth.emailShort")}>
            <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">{i18n.t("settings.updates")}</span>
                <button
                    role="switch"
                    aria-checked={optIn}
                    aria-label={i18n.t("settings.updates")}
                    onClick={toggle}
                    disabled={loading || saving}
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

            {suppressed && (
                <p className="text-sm text-red-400">
                    {i18n.t("profile.weAreNotSending")}
                </p>
            )}
        </SettingsCard>
    );
};

export default EmailSettings;
