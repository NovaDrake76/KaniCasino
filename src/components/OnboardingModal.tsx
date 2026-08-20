import { useState } from "react";
import { AiOutlineClockCircle } from "react-icons/ai";
import Modal from "./Modal";
import MainButton from "./MainButton";
import i18n from "../i18n";

const SEEN_KEY = "kani.onboardingSeen";

const steps = () => [
  {
    image: "/images/coinHeads.webp",
    title: i18n.t("common.startWithFreeCoins"),
    text: i18n.t("common.startWithFreeCoinsBody", { button: i18n.t("bonus.claim") }),
  },
  {
    image: "/images/boo.webp",
    title: i18n.t("common.playAndWin"),
    text: i18n.t("common.betOnTheGames"),
  },
  {
    icon: <AiOutlineClockCircle className="w-14 h-14 shrink-0 text-accent-gold" />,
    title: i18n.t("common.emptyOnCash"),
    text: i18n.t("common.theFreeBonusComes"),
  },
];

const OnboardingModal = () => {
  // storage can be blocked; then the tour shows every visit, which is harmless
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(SEEN_KEY);
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // nothing to do: the modal still closes for the session
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Modal open={open} setOpen={dismiss} width="520px">
      <div className="flex flex-col items-center gap-5">
        <h2 className="text-2xl font-bold text-center">
          {i18n.t("common.welcomeToKanicasino")}
        </h2>
        <p className="text-ink-soft text-sm text-center">
          {i18n.t("common.everythingHereRunsOn")}
        </p>
        <div className="flex flex-col gap-3 w-full">
          {steps().map((step) => (
            <div
              key={step.title}
              className="flex items-center gap-4 bg-surface rounded-md p-4"
            >
              {step.icon ?? (
                <img
                  src={step.image}
                  alt=""
                  className="w-14 h-14 object-contain shrink-0"
                />
              )}
              <div className="flex flex-col gap-1">
                <span className="font-bold">{step.title}</span>
                <span className="text-ink-soft text-sm">{step.text}</span>
              </div>
            </div>
          ))}
        </div>
        <MainButton text={i18n.t("common.gotItLetS")} onClick={dismiss} />
      </div>
    </Modal>
  );
};

export default OnboardingModal;
