import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaDiscord } from "react-icons/fa";
import { FiMail, FiCheckCircle } from "react-icons/fi";
import Modal from "../Modal";
import UserContext from "../../UserContext";
import { me } from "../../services/auth/auth";
import { problemOf, sendVerificationEmail, Verification, VerifyProblem } from "../../services/account/AccountService";
import { useDiscordConnect } from "../../services/discord/useDiscordConnect";
import { VERIFY_OPEN_EVENT } from "./verifyEvents";
import i18n from "../../i18n";

const BUTTON =
  "flex h-11 w-full items-center justify-center gap-2 rounded-md border-none text-sm font-bold text-white hover:border-none focus:outline-none disabled:opacity-50";

// the ways to verify, in one place for every screen that needs it: a link to the account's address, or a discord link
const VerifyModal = () => {
  const { userData, toogleUserData } = useContext(UserContext);
  const navigate = useNavigate();
  const { connect, busy: connecting } = useDiscordConnect();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<VerifyProblem | "failed" | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setSentTo(null);
      setProblem(null);
      setOpen(true);
    };
    window.addEventListener(VERIFY_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(VERIFY_OPEN_EVENT, onOpen);
  }, []);

  const v: Verification | undefined = userData?.verification;
  if (!userData || !v) return null;

  const send = async () => {
    setSending(true);
    setProblem(null);
    try {
      const res = await sendVerificationEmail();
      if (res.alreadyVerified) toogleUserData(await me());
      else if (res.sent) setSentTo(res.to || v.email);
      else setProblem("failed");
    } catch (err) {
      setProblem(problemOf(err).reason || "failed");
    }
    setSending(false);
  };

  const toSettings = () => {
    setOpen(false);
    navigate(`/profile/${userData.id}?tab=settings`);
  };

  return (
    <Modal open={open} setOpen={setOpen} width="min(520px, 95vw)">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-bold">{i18n.t("verify.title")}</span>
          <span className="text-sm leading-relaxed text-ink-soft">{i18n.t("verify.why")}</span>
        </div>

        {v.verified ? (
          <div className="flex items-center gap-3 bg-surface p-4">
            <FiCheckCircle className="shrink-0 text-2xl text-green-400" />
            <span className="font-semibold">
              {i18n.t("verify.verified")} {v.via && <span className="text-ink-muted">({i18n.t(`verify.via.${v.via}`)})</span>}
            </span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 bg-surface p-4">
              <span className="flex items-center gap-2 font-bold">
                <FiMail className="text-accent-light" />
                {i18n.t("verify.emailOption")}
              </span>
              {sentTo ? (
                <span className="text-sm text-green-400">{i18n.t("verify.sent", { email: sentTo })}</span>
              ) : (
                <>
                  <span className="text-sm text-ink-soft">{i18n.t("verify.emailBody", { email: v.email || "" })}</span>
                  <button type="button" onClick={send} disabled={sending || !v.email} className={`${BUTTON} bg-accent hover:bg-accent-light`}>
                    {i18n.t("verify.send")}
                  </button>
                </>
              )}
              {problem && <span className="text-sm text-red-400">{i18n.t(`verify.errors.${problem}`)}</span>}
              {v.canChangeEmail && (
                <button type="button" onClick={toSettings} className="self-start rounded-none border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-secondary-light hover:text-white focus:outline-none">
                  {i18n.t("verify.changeEmail")}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 bg-surface p-4">
              <span className="flex items-center gap-2 font-bold">
                <FaDiscord className="text-[#5865F2]" />
                {i18n.t("verify.discordOption")}
              </span>
              <span className="text-sm text-ink-soft">{i18n.t("verify.discordBody")}</span>
              <button type="button" onClick={connect} disabled={connecting} className={`${BUTTON} bg-[#5865F2] hover:bg-[#4752c4]`}>
                {i18n.t("verify.discordButton")}
              </button>
            </div>

            <span className="text-xs leading-relaxed text-ink-muted">{i18n.t("verify.googleHint")}</span>
          </>
        )}
      </div>
    </Modal>
  );
};

export default VerifyModal;
