import { useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import UserContext from "../../UserContext";
import i18n from "../../i18n";
import {
    completeDiscordLink,
    setPendingDiscordCode,
    takePendingDiscordCode,
} from "../../services/discord/DiscordLinkService";

type State = "working" | "needLogin" | "done" | "failed";

// landing point of the bot's /link url. the site session is what says which account is
// being linked, so a visitor who is not logged in yet signs in first and lands back here.
const LinkDiscord = () => {
    const [params] = useSearchParams();
    const { isLogged, toogleUserFlow } = useContext(UserContext);
    const [state, setState] = useState<State>("working");
    const [name, setName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const sent = useRef(false);

    useEffect(() => {
        const code = (params.get("code") || takePendingDiscordCode() || "").trim();
        if (!code) return setState("failed");

        if (!isLogged) {
            setPendingDiscordCode(code);
            setState("needLogin");
            toogleUserFlow(true);
            return;
        }

        if (sent.current) return;
        sent.current = true;
        // the login panel has done its job, and would otherwise sit on top of the answer
        toogleUserFlow(false);
        completeDiscordLink(code)
            .then((result) => {
                setName(result.discordName);
                setState("done");
            })
            .catch((err) => {
                setError(err?.response?.data?.message || null);
                setState("failed");
            });
    }, [params, isLogged, toogleUserFlow]);

    return (
        <div className="w-full flex items-center justify-center px-4 py-16">
            <div className="max-w-md w-full flex flex-col items-center gap-3 text-center bg-surface border border-line rounded-lg p-8">
                {state === "working" && <span className="text-ink-soft">{i18n.t("discord.linking")}</span>}
                {state === "needLogin" && (
                    <>
                        <span className="text-xl font-bold">{i18n.t("discord.needLogin")}</span>
                        <span className="text-sm text-ink-soft">{i18n.t("discord.needLoginBody")}</span>
                    </>
                )}
                {state === "done" && (
                    <>
                        <span className="text-xl font-bold">{i18n.t("discord.linked")}</span>
                        <span className="text-sm text-ink-soft">
                            {i18n.t("discord.linkedBody", { name: name || "Discord" })}
                        </span>
                        <Link to="/" className="text-sm text-ink-muted underline">
                            {i18n.t("discord.keepPlaying")}
                        </Link>
                    </>
                )}
                {state === "failed" && (
                    <>
                        <span className="text-xl font-bold">{i18n.t("discord.failed")}</span>
                        <span className="text-sm text-ink-soft">{error || i18n.t("discord.tryAgain")}</span>
                    </>
                )}
            </div>
        </div>
    );
};

export default LinkDiscord;
