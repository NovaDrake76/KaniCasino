import { useEffect, useState } from "react";
import { speech } from "./speechStore";

// letters a second; fast enough to keep up with a reader, slow enough to read as her talking
const PER_SECOND = 45;

// no media queries (a test runner) or a player who asked for less motion both get the whole line at once
const animated = () => typeof window.matchMedia === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  text: string;
  // her own voice: while this types, the drawing of her moves its mouth
  voiced?: boolean;
}

// a line that types itself out. the untyped rest is laid out invisibly, so the box has its final size from the first letter
const TypedText = ({ text, voiced }: Props) => {
  const [typed, setTyped] = useState(() => ({ text, shown: animated() ? 0 : text.length }));
  // a new line starts from nothing on the very render it arrives, not one frame later
  const shown = typed.text === text ? typed.shown : animated() ? 0 : text.length;

  useEffect(() => {
    if (!animated()) {
      setTyped({ text, shown: text.length });
      return;
    }
    setTyped({ text, shown: 0 });
    let voice = !!voiced;
    if (voice) speech.start();
    const quiet = () => {
      if (!voice) return;
      voice = false;
      speech.stop();
    };
    const started = Date.now();
    const timer = window.setInterval(() => {
      const next = Math.min(text.length, Math.floor(((Date.now() - started) / 1000) * PER_SECOND));
      setTyped({ text, shown: next });
      if (next >= text.length) {
        window.clearInterval(timer);
        quiet();
      }
    }, 1000 / PER_SECOND);
    return () => {
      window.clearInterval(timer);
      quiet();
    };
  }, [text, voiced]);

  if (shown >= text.length) return <>{text}</>;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{text.slice(0, shown)}</span>
      <span aria-hidden className="invisible">
        {text.slice(shown)}
      </span>
    </>
  );
};

export default TypedText;
