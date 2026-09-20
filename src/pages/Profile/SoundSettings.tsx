import { HiOutlineSpeakerWave, HiOutlineSpeakerXMark } from "react-icons/hi2";
import { play } from "../../services/sound/sound";
import { useSoundPrefs } from "../../services/sound/useSound";
import i18n from "../../i18n";

const STEPS = [0.25, 0.5, 0.75, 1];

const SoundSettings = () => {
  const { muted, volume, toggleMuted, setVolume } = useSoundPrefs();
  const on = !muted;
  const percent = Math.round(volume * 100);

  return (
    <>
      <span className="text-lg font-bold">{i18n.t("settings.sound")}</span>

      <div className="flex flex-col bg-surface border border-line rounded-lg">
        <div className="flex items-start justify-between gap-4 p-4">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{i18n.t("settings.soundEffects")}</span>
            <span className="text-sm text-ink-muted">{i18n.t("settings.soundHint")}</span>
          </div>
          <button
            role="switch"
            aria-checked={on}
            aria-label={i18n.t("settings.soundEffects")}
            onClick={toggleMuted}
            className={`relative w-12 h-6 shrink-0 rounded-full border border-line transition-colors ${on ? "bg-accent" : "bg-surface-nav"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-6" : ""}`} />
          </button>
        </div>

        <div className={`flex flex-col gap-3 border-t border-line p-4 transition-opacity ${on ? "" : "opacity-40 pointer-events-none"}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{i18n.t("settings.volume")}</span>
            <span className="font-mono text-sm text-ink-soft tabular-nums">{percent}%</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={i18n.t("settings.volumeDown")}
              onClick={() => setVolume(Math.max(0, volume - 0.1))}
              className="text-ink-muted transition-colors hover:text-white"
            >
              <HiOutlineSpeakerXMark size={20} />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={percent}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              onPointerUp={() => play("ui.confirm", { throttleMs: 0 })}
              aria-label={i18n.t("settings.volume")}
              className="sound-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-nav"
              style={{ backgroundImage: `linear-gradient(to right, #4F46E5 ${percent}%, transparent ${percent}%)` }}
            />
            <button
              type="button"
              aria-label={i18n.t("settings.volumeUp")}
              onClick={() => setVolume(Math.min(1, volume + 0.1))}
              className="text-ink-muted transition-colors hover:text-white"
            >
              <HiOutlineSpeakerWave size={20} />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setVolume(step)}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                    Math.abs(volume - step) < 0.005 ? "bg-accent text-white" : "bg-surface-nav text-ink-soft hover:text-white"
                  }`}
                >
                  {Math.round(step * 100)}%
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => play("game.win", { throttleMs: 0 })}
              className="border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-white"
            >
              {i18n.t("settings.playTestSound")}
            </button>
          </div>
        </div>
        <style>{`
          .sound-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 9999px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.5); }
          .sound-slider::-moz-range-thumb { width: 18px; height: 18px; border: 0; border-radius: 9999px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.5); }
        `}</style>
      </div>
    </>
  );
};

export default SoundSettings;
