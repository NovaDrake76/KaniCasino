import { TimeseriesPoint } from "../../services/admin/AdminServices";

// series colors validated against the dark card surface (lightness band, cvd
// separation and contrast); text never wears these, only marks do
export const CHART_INDIGO = "#606BC7";
export const CHART_AMBER = "#C08312";

const DAY_MS = 24 * 60 * 60 * 1000;
export const dayString = (date: Date) => date.toISOString().slice(0, 10);

// the api only returns days that had activity; charts need a continuous axis
export function fillDays(points: TimeseriesPoint[], windowDays: number | null): TimeseriesPoint[] {
  const span = windowDays || 90;
  const byDay = new Map(points.map((p) => [p.day, p]));
  const first = points.length ? points[0].day : dayString(new Date(Date.now() - (span - 1) * DAY_MS));
  const start = new Date(Math.max(new Date(`${first}T00:00:00Z`).getTime(), Date.now() - (span - 1) * DAY_MS));
  const out: TimeseriesPoint[] = [];
  for (let t = start.getTime(); t <= Date.now(); t += DAY_MS) {
    const day = dayString(new Date(t));
    out.push(byDay.get(day) || { day, wagered: 0, paidOut: 0, ggr: 0, faucet: 0, players: 0 });
  }
  return out;
}

export const shortDay = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
};

export const compactKp = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}${Math.round(abs)}`;
};
