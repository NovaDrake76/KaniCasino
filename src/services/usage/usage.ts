import api from "../api";
import { getAccessToken } from "../auth/authUtils";

// what the site records about how daisu's card, her room, her shop and the pages her shop locks are used, and the
// params each event carries. backend/utils/usage.js allows exactly this list, and a test holds the two equal
export interface UsageEvents {
  daisu_open: { via: string; showing?: string; attention?: boolean };
  daisu_room: { via: string; from: string; item?: string };
  daisu_close: { via: string; from: string; secs?: number };
  mission_help: { mission: string };
  mission_claim_failed: { mission: string; status: number };
  shop_item: { item: string; state: string; via: string };
  shop_buy_failed: { item: string; status: number; reason?: string };
  locked_view: { unlock: string };
  help_start: { goal: string; mission: string };
  help_end: { goal: string; step: string };
  tour_step: { step: string };
}

type Name = keyof UsageEvents;

interface Queued {
  name: Name;
  params: UsageEvents[Name];
  path: string;
  t: number;
}

// events wait this long to go out together, unless this many pile up first
const FLUSH_MS = 30000;
const BATCH = 20;
const SID_KEY = "kani.sid";

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sid: string | null = null;

const token = () => {
  try {
    return getAccessToken();
  } catch {
    return null;
  }
};

// one id per tab, so a report can read one visit's events in order
const sessionId = () => {
  if (sid) return sid;
  const fresh = Math.random().toString(36).slice(2, 12);
  try {
    sid = sessionStorage.getItem(SID_KEY) || fresh;
    sessionStorage.setItem(SID_KEY, sid);
  } catch {
    sid = fresh;
  }
  return sid;
};

const takeBatch = () => {
  const now = Date.now();
  const events = queue.map((e) => ({ name: e.name, params: e.params, path: e.path, ago: now - e.t }));
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
  return { sid: sessionId(), events };
};

export const flushUsage = () => {
  if (!queue.length) return;
  if (!token()) {
    takeBatch();
    return;
  }
  api.post("/usage", takeBatch()).catch(() => undefined);
};

// the tab is going away, and a keepalive fetch outlives the page where the axios request would be cancelled
const flushOnHide = () => {
  const t = token();
  if (!queue.length || !t) return;
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
  if (import.meta.env.VITE_API_KEY) headers["x-api-key"] = import.meta.env.VITE_API_KEY;
  try {
    fetch(`${import.meta.env.VITE_BASE_URL}/usage`, { method: "POST", keepalive: true, headers, body: JSON.stringify(takeBatch()) }).catch(() => undefined);
  } catch {
    // a browser that cannot send it loses the last seconds of the visit, which the report can live without
  }
};

// never throws and never waits: a player's click must not depend on this reaching the server
export const track = <K extends Name>(name: K, params: UsageEvents[K]) => {
  if (!token()) return;
  queue.push({ name, params, path: window.location.pathname, t: Date.now() });
  if (queue.length >= BATCH) flushUsage();
  else if (!timer) timer = setTimeout(flushUsage, FLUSH_MS);
};

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnHide();
  });
  window.addEventListener("pagehide", flushOnHide);
}
