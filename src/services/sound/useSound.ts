import { useCallback, useSyncExternalStore } from "react";
import { sound, SoundPrefs } from "./sound";

export const useSoundPrefs = () => {
  const prefs: SoundPrefs = useSyncExternalStore(sound.subscribe, sound.getPrefs, sound.getPrefs);
  const toggleMuted = useCallback(() => sound.toggleMuted(), []);
  const setVolume = useCallback((v: number) => sound.setVolume(v), []);
  return { ...prefs, toggleMuted, setVolume };
};

export { play, sound } from "./sound";
export type { SoundEvent } from "./events";
