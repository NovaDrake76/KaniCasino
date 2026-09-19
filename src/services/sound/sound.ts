// one AudioContext, opened on the first user gesture; public/sounds/manifest.json maps each event to its files and an empty entry stays silent
import { SOUND_DEFAULTS, SoundEvent, SoundOptions } from "./events";

export interface SoundPrefs {
  muted: boolean;
  // 0..1 master volume
  volume: number;
}

type Manifest = Record<string, string[]>;

const PREF_KEY = "kani.sound";
const MANIFEST = "/sounds/manifest.json";
const DEFAULT_PREFS: SoundPrefs = { muted: false, volume: 0.7 };
// decoded as soon as audio unlocks, so the first click is not late
const WARM: SoundEvent[] = ["ui.click", "ui.confirm", "ui.error", "daisu.jar", "game.bet", "case.tick"];

const readPrefs = (): SoundPrefs => {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw);
    return {
      muted: !!p.muted,
      volume: typeof p.volume === "number" ? Math.max(0, Math.min(1, p.volume)) : DEFAULT_PREFS.volume,
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

const writePrefs = (p: SoundPrefs) => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // private mode or a full quota: the setting still holds for the session
  }
};

class SoundService {
  private prefs: SoundPrefs = readPrefs();
  private manifest: Manifest | null = null;
  private manifestPromise: Promise<void> | null = null;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private lastPlayed = new Map<SoundEvent, number>();
  private soloNodes = new Map<SoundEvent, AudioBufferSourceNode>();
  private listeners = new Set<() => void>();
  private pending: SoundEvent[] = [];

  constructor() {
    if (typeof window !== "undefined") this.installUnlock();
  }

  getPrefs = (): SoundPrefs => this.prefs;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private update(patch: Partial<SoundPrefs>) {
    this.prefs = { ...this.prefs, ...patch };
    writePrefs(this.prefs);
    if (this.master) this.master.gain.value = this.effectiveVolume();
    this.listeners.forEach((fn) => fn());
  }

  toggleMuted() {
    this.update({ muted: !this.prefs.muted });
  }

  setVolume(volume: number) {
    this.update({ volume: Math.max(0, Math.min(1, volume)) });
  }

  private effectiveVolume() {
    return this.prefs.muted ? 0 : this.prefs.volume;
  }

  // browsers only start audio inside a user gesture, so play() is a no-op until the first one.
  // the listeners stay until the context is really running: ios counts only some gestures
  private installUnlock() {
    const events = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
    const unlock = () => {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const done = () => {
        if (ctx.state !== "running") return;
        events.forEach((e) => window.removeEventListener(e, unlock, true));
        void this.warm();
      };
      if (ctx.state === "suspended") ctx.resume().then(done, () => undefined);
      else done();
    };
    events.forEach((e) => window.addEventListener(e, unlock, true));
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.effectiveVolume();
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private loadManifest(): Promise<void> {
    if (this.manifestPromise) return this.manifestPromise;
    this.manifestPromise = fetch(MANIFEST)
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { events?: Manifest } | null) => {
        this.manifest = m?.events || {};
      })
      .catch(() => {
        this.manifest = {};
      });
    return this.manifestPromise;
  }

  private fileFor(event: SoundEvent): string | null {
    const files = this.manifest?.[event];
    if (!files || files.length === 0) return null;
    return `/sounds/${files[Math.floor(Math.random() * files.length)]}`;
  }

  private buffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    const p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    this.buffers.set(url, p);
    return p;
  }

  private async warm() {
    await this.loadManifest();
    if (!this.manifest || !this.ctx) return;
    const urls = new Set<string>();
    for (const ev of [...WARM, ...this.pending]) for (const f of this.manifest[ev] || []) urls.add(`/sounds/${f}`);
    const run = () => urls.forEach((u) => void this.buffer(u));
    if ("requestIdleCallback" in window) (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
    else setTimeout(run, 500);
  }

  // decodes a page's slots ahead of time; a no-op before the first gesture, and warm() covers those then
  preload(events: SoundEvent[]) {
    this.pending = events;
    if (!this.ctx) return;
    void this.loadManifest().then(() => {
      for (const ev of events) for (const f of this.manifest?.[ev] || []) void this.buffer(`/sounds/${f}`);
    });
  }

  // whether any slot played in the last few ms, so a toast does not stack its chime on a sound just played
  playedRecently(ms: number) {
    let latest = 0;
    this.lastPlayed.forEach((t) => {
      if (t > latest) latest = t;
    });
    return performance.now() - latest < ms;
  }

  // safe from anywhere, any number of times: throttled per event, silent before the first gesture, while muted, or for an empty slot
  play(event: SoundEvent, opts: SoundOptions = {}) {
    if (this.prefs.muted) return;
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o: SoundOptions = { ...(SOUND_DEFAULTS[event] || {}), ...opts };
    const now = performance.now();
    if (o.throttleMs) {
      const last = this.lastPlayed.get(event) || 0;
      if (now - last < o.throttleMs) return;
    }
    this.lastPlayed.set(event, now);
    if (!this.manifest) {
      void this.loadManifest();
      return;
    }
    const url = this.fileFor(event);
    if (!url) return;
    const rate = o.rate ? o.rate[0] + Math.random() * (o.rate[1] - o.rate[0]) : 1;
    const volume = o.volume ?? 0.6;
    void this.buffer(url).then((buf) => {
      if (!buf || this.prefs.muted) return;
      // a decode slow enough for the moment to pass is dropped, not played late
      if (performance.now() - now > 400) return;
      if (o.solo) this.stop(event);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(this.master as GainNode);
      src.start();
      if (o.solo) {
        this.soloNodes.set(event, src);
        src.onended = () => {
          if (this.soloNodes.get(event) === src) this.soloNodes.delete(event);
        };
      }
    });
  }

  // stops a solo event early
  stop(event: SoundEvent) {
    const node = this.soloNodes.get(event);
    if (!node) return;
    try {
      node.stop();
    } catch {
      // already ended
    }
    this.soloNodes.delete(event);
  }
}

export const sound = new SoundService();
export const play = (event: SoundEvent, opts?: SoundOptions) => sound.play(event, opts);
