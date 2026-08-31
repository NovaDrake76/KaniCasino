import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { GiWaterDrop } from "react-icons/gi";
import UserContext from "../../UserContext";
import Monetary from "../Monetary";
import {
  RainState,
  joinRain,
  onRainPool,
  onRainSettled,
  onRainState,
  onRainWon,
  requestRain,
} from "../../services/chat/RainService";
import i18n from "../../i18n";

const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

export const splitRemaining = (ms: number) => {
  if (!(ms > 0)) return "00:00";
  const total = Math.floor(ms / 1000);
  return `${pad(total / 60)}:${pad(total % 60)}`;
};

// the bar drains rather than fills, so the panel reads as time running out on a thing you
// have to be in for. full at the top of the round, empty as it drops.
export const remainingShare = (endsAt: number, startsAt: number, now: number) => {
  const span = endsAt - startsAt;
  if (!(span > 0)) return 0;
  return Math.max(0, Math.min(1, (endsAt - now) / span));
};

// the last stretch, where the panel stops being furniture and starts being a prompt
const IMMINENT_MS = 60000;

// a pool under the floor does not fall, it rolls into the next round. saying so is the
// whole point: without it the panel shows a countdown, a join button and a figure, and
// then nothing happens and nobody can tell whether it broke.
export const isBuilding = (pool: number, minPool: number) => pool < minPool;

// the figure walks to its new value instead of jumping: the pool moves whenever anyone on
// the site bets, and a number that silently changes is a number nobody notices.
const useCountUp = (value: number) => {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const began = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - began) / 700);
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) {
        from.current = value;
        clearInterval(timer);
      }
    }, 40);
    return () => clearInterval(timer);
  }, [value]);

  return shown;
};

// the reason to leave the chat open. a share of what the site wagered over the half hour,
// split between whoever was in the room for it, then it starts again.
const RainPool = () => {
  const { userData } = useContext(UserContext);
  const [state, setState] = useState<RainState | null>(null);
  const [left, setLeft] = useState("");
  const [share, setShare] = useState(1);
  const [busy, setBusy] = useState(false);

  // the device clock can be minutes out; the countdown runs off the server's
  const skew = useRef(0);
  const window_ = useRef({ startsAt: 0, endsAt: 0 });

  useEffect(() => {
    const offState = onRainState((next) => {
      skew.current = Date.now() - new Date(next.serverTime).getTime();
      window_.current = {
        startsAt: new Date(next.startsAt).getTime(),
        endsAt: new Date(next.endsAt).getTime(),
      };
      setState(next);
    });
    const offPool = onRainPool(({ roundId, pool }) =>
      setState((prev) => (prev && prev.roundId === roundId ? { ...prev, pool } : prev))
    );
    const offSettled = onRainSettled(() => requestRain());
    const offWon = onRainWon(({ amount }) =>
      toast.success(i18n.t("rain.won", { amount: amount.toLocaleString("en-US") }), { theme: "dark" })
    );
    requestRain();
    return () => {
      offState();
      offPool();
      offSettled();
      offWon();
    };
  }, [userData?.id]);

  useEffect(() => {
    if (!state) return;
    const tick = () => {
      const now = Date.now() - skew.current;
      setLeft(splitRemaining(window_.current.endsAt - now));
      setShare(remainingShare(window_.current.endsAt, window_.current.startsAt, now));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state]);

  const pool = useCountUp(state ? state.pool : 0);

  const enter = async () => {
    setBusy(true);
    const result = await joinRain();
    setBusy(false);
    if (result && result.error) {
      const key = result.error === "level" ? "rain.needLevel" : `chat.errors.${result.error}`;
      toast.error(i18n.t(key, { level: result.minLevel, defaultValue: i18n.t("chat.errors.failed") }), {
        theme: "dark",
      });
      return;
    }
    if (result) setState(result);
  };

  if (!state) return null;

  const building = isBuilding(state.pool, state.minPool);
  const imminent =
    !building && share > 0 && window_.current.endsAt - (Date.now() - skew.current) <= IMMINENT_MS;

  return (
    <div
      className={`relative border-b bg-surface-nav px-3 pb-3 pt-2.5 ${
        imminent ? "border-b-accent-amber bg-[#241f13]" : "border-b-line"
      }`}
      style={imminent ? { boxShadow: "inset 0 0 0 1px rgba(236,168,35,0.35)" } : undefined}
    >
      <div className="flex items-center gap-2.5">
        <GiWaterDrop
          className={`flex-shrink-0 text-lg ${imminent ? "animate-bounce text-accent-amber" : "text-secondary-light"}`}
        />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[16px] font-extrabold tabular-nums text-accent-gold">
            <Monetary value={pool} />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            {imminent ? i18n.t("rain.aboutTo") : i18n.t("rain.title")}
          </span>
        </div>

        {userData ? (
          <button
            type="button"
            onClick={enter}
            disabled={busy || state.joined}
            className={`flex-shrink-0 px-2.5 py-1.5 text-[11px] font-bold ${
              state.joined
                ? "bg-surface text-ink-muted"
                : "bg-accent text-white hover:bg-accent-light disabled:opacity-50"
            }`}
          >
            {state.joined ? i18n.t("rain.joined") : i18n.t("rain.join")}
          </button>
        ) : (
          <span className="flex-shrink-0 text-[10px] text-ink-faint">{i18n.t("rain.logIn")}</span>
        )}
      </div>

      {/* a countdown to a drop that cannot happen is worse than no countdown. while the
          pool is under the floor the panel says what it is waiting for instead. */}
      <div className="mt-2 text-[10px] text-ink-faint">
        {building ? (
          <span>
            {i18n.t("rain.building", { amount: (state.minPool - state.pool).toLocaleString("en-US") })}
          </span>
        ) : (
          <span className="tabular-nums">{i18n.t("rain.in", { time: left })}</span>
        )}
      </div>

      {/* the bar drains with the clock, or fills toward the floor while the pool is still
          too small to fall: either way it is showing what has to happen next */}
      <div className="absolute bottom-0 left-0 h-[3px] w-full bg-surface">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            imminent ? "bg-accent-amber" : building ? "bg-line-strong" : "bg-secondary"
          }`}
          style={{
            width: `${(building ? Math.min(1, state.pool / state.minPool) : share) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

export default RainPool;
