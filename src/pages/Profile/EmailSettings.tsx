import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getEmailPreferences, setMarketingOptIn } from "../../services/email/EmailService";

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
            toast.success(next ? "You will get updates about new cases and games" : "Updates turned off", {
                theme: "dark",
            });
        } catch {
            setOptIn(!next);
            toast.error("Could not save that, try again", { theme: "dark" });
        }
        setSaving(false);
    };

    if (loading) return <span className="text-ink-muted text-sm">Loading...</span>;

    return (
        <div className="w-full max-w-2xl flex flex-col gap-4">
            <span className="text-lg font-bold">Email</span>

            <div className="flex items-start justify-between gap-4 bg-surface border border-line rounded-lg p-4">
                <div className="flex flex-col gap-1">
                    <span className="font-semibold">Updates about new cases and games</span>
                    <span className="text-sm text-ink-muted">
                        Occasional email when something new ships. Off unless you turn it on, and you
                        can stop it any time.
                    </span>
                </div>
                <button
                    role="switch"
                    aria-checked={optIn}
                    aria-label="Updates about new cases and games"
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
                Service messages about your account, such as security and policy notices, are sent
                whatever this is set to.
            </p>

            {suppressed && (
                <p className="text-sm text-red-400">
                    We are not sending to your address because a previous email bounced or was
                    reported as spam. Contact us if you think that is wrong.
                </p>
            )}
        </div>
    );
};

export default EmailSettings;
