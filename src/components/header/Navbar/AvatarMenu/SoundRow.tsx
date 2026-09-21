import { HiOutlineSpeakerWave, HiOutlineSpeakerXMark } from "react-icons/hi2";
import { play } from "../../../../services/sound/sound";
import { useSoundPrefs } from "../../../../services/sound/useSound";
import i18n from "../../../../i18n";

const reset = "rounded-none border-none p-0 hover:border-none focus:outline-none";

// the master volume, read and written where the settings page does; the row is its own component so the card stays a plain view
const SoundRow = () => {
  const { muted, volume, toggleMuted, setVolume } = useSoundPrefs();
  const percent = Math.round(volume * 100);

  return (
    <div className="flex h-11 items-center gap-3 px-4 text-sm text-ink-soft">
      <button
        type="button"
        onClick={toggleMuted}
        aria-label={i18n.t("settings.soundEffects")}
        aria-pressed={!muted}
        className={`bg-transparent text-lg text-ink-faint transition-colors hover:text-white focus-visible:text-white ${reset}`}
      >
        {muted ? <HiOutlineSpeakerXMark /> : <HiOutlineSpeakerWave />}
      </button>
      <span className="shrink-0">{i18n.t("settings.sound")}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        disabled={muted}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        onPointerUp={() => play("ui.confirm", { throttleMs: 0 })}
        aria-label={i18n.t("settings.volume")}
        className="menu-slider h-1.5 min-w-0 flex-1 cursor-pointer appearance-none bg-line-strong disabled:cursor-default disabled:opacity-40"
        style={{ backgroundImage: `linear-gradient(to right, #4F46E5 ${percent}%, transparent ${percent}%)` }}
      />
      <span className={`w-9 text-right text-xs tabular-nums text-ink-muted ${muted ? "opacity-40" : ""}`}>{percent}%</span>
      <style>{`
        .menu-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 9999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.5); }
        .menu-slider::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 9999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.5); }
      `}</style>
    </div>
  );
};

export default SoundRow;
