import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { unsubscribeByToken } from "../../services/email/EmailService";

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
                {state === "working" && <span className="text-ink-soft">Updating your preferences...</span>}
                {state === "done" && (
                    <>
                        <span className="text-xl font-bold">You are unsubscribed</span>
                        <span className="text-sm text-ink-soft">
                            We will not send you any more updates about new cases and games. You will
                            still get service messages about your account, like security and policy
                            notices.
                        </span>
                        <span className="text-sm text-ink-muted">
                            Changed your mind? You can turn updates back on in your profile settings.
                        </span>
                    </>
                )}
                {state === "failed" && (
                    <>
                        <span className="text-xl font-bold">That link did not work</span>
                        <span className="text-sm text-ink-soft">
                            It may have already been used. You can always manage email in your profile
                            settings.
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

export default Unsubscribe;
