import { useState } from "react";
import Modal from "./Modal";
import MainButton from "./MainButton";

const SEEN_KEY = "kani.onboardingSeen";

const steps = [
  {
    image: "/images/coinHeads.webp",
    title: "Start with free coins",
    text: "Every new account gets a free K₽ balance, and the Claim Bonus button in the navbar adds more.",
  },
  {
    image: "/images/boo.webp",
    title: "Play and win",
    text: "Bet on the games, open cases, and sell or upgrade the items you unbox.",
  },
  {
    image: "/images/clock.webp",
    title: "Empty on cash?",
    text: "The free bonus comes back every 8 minutes. Wait out the cooldown, claim it, and keep playing.",
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
        <h2 className="text-2xl font-bold text-center">Welcome to KaniCasino!</h2>
        <p className="text-ink-soft text-sm text-center">
          Everything here runs on K₽, a fictional coin. It is never real money and
          there is nothing to buy or cash out, so play as much as you want.
        </p>
        <div className="flex flex-col gap-3 w-full">
          {steps.map((step) => (
            <div key={step.title} className="flex items-center gap-4 bg-surface rounded-md p-4">
              <img src={step.image} alt="" className="w-14 h-14 object-contain shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="font-bold">{step.title}</span>
                <span className="text-ink-soft text-sm">{step.text}</span>
              </div>
            </div>
          ))}
        </div>
        <MainButton text="Got it, let's play!" onClick={dismiss} />
      </div>
    </Modal>
  );
};

export default OnboardingModal;
