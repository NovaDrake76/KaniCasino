import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { unsubscribeByToken } from "../../services/email/EmailService";
import i18n from "../../i18n";

type State = "working" | "done" | "failed";

const Unsubscribe = () => {
    const [params] = useSearchParams();
    const [state, setState] = useState<State>("working");

    useEffect(() => {
        const u = params.get("u");
        const t = params.get("t");
        if (!u || !t) return setState("failed");
        unsubscribeByToken(u, t)
            .then(() => setState("done"))
            .catch(() => setState("failed"));
    }, [params]);

    return (
        <div className="w-full flex items-center justify-center px-4 py-16">
            <div className="max-w-md w-full flex flex-col items-center gap-3 text-center bg-surface border border-line rounded-lg p-8">
                {state === "working" && <span className="text-ink-soft">{i18n.t("about.updatingYourPreferences")}</span>}
                {state === "done" && (
                    <>
                        <span className="text-xl font-bold">{i18n.t("about.youAreUnsubscribed")}</span>
                        <span className="text-sm text-ink-soft">
                            {i18n.t("about.weWillNotSend")}
                        </span>
                        <span className="text-sm text-ink-muted">
                            {i18n.t("about.changedYourMindYou")}
                        </span>
                    </>
                )}
                {state === "failed" && (
                    <>
                        <span className="text-xl font-bold">{i18n.t("about.thatLinkDidNot")}</span>
                        <span className="text-sm text-ink-soft">
                            {i18n.t("about.itMayHaveAlready")}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

export default Unsubscribe;
