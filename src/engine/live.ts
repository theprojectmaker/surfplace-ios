// Real measurements near a spot, fetched straight from NOAA (a native app has no browser
// restrictions, so no relay is needed):
//   - NDBC buoys: measured wave height / period / direction, wind, water temperature
//   - CO-OPS tide stations: official high / low tide times
import { Spot } from './types';

export type Buoy = {
  id: string; lat: number; lon: number; time: number; km: number;
  wdir: number | null; wspd: number | null; gst: number | null;
  wvht: number | null; dpd: number | null; apd: number | null; mwd: number | null;
  atmp: number | null; wtmp: number | null;
};
export type TideEvent = { t: string; v: number; type: 'H' | 'L' };
export type TideData = { station: { id: string; name: string; km: number }; hilo: TideEvent[] };
export type LiveData = { buoy: Buoy | null; wind: Buoy | null; water: Buoy | null; tide: TideData | null };

type Row = Omit<Buoy, 'km'>;

export function km(la1: number, lo1: number, la2: number, lo2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

async function getText(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('status ' + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- buoys ----------
let obs: { at: number; rows: Row[] } | null = null;

export function parseBuoys(text: string, now: number): Row[] {
  const rows: Row[] = [];
  text.split('\n').forEach((line) => {
    if (!line || line[0] === '#') return;
    const c = line.trim().split(/\s+/);
    if (c.length < 19) return;
    const n = (i: number) => (c[i] === 'MM' ? null : Number(c[i]));
    const time = Date.UTC(+c[3], +c[4] - 1, +c[5], +c[6], +c[7]);
    if (!isFinite(time) || now - time > 3 * 3600 * 1000) return; // stale reading
    rows.push({
      id: c[0], lat: +c[1], lon: +c[2], time,
      wdir: n(8), wspd: n(9), gst: n(10), wvht: n(11), dpd: n(12), apd: n(13), mwd: n(14),
      atmp: n(17), wtmp: n(18),
    });
  });
  return rows;
}

async function buoyRows(): Promise<Row[]> {
  if (obs && Date.now() - obs.at < 10 * 60 * 1000) return obs.rows;
  const rows = parseBuoys(await getText('https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'), Date.now());
  if (!rows.length) throw new Error('no buoy rows');
  obs = { at: Date.now(), rows };
  return rows;
}

function nearest(rows: Row[], lat: number, lon: number, has: (r: Row) => boolean, maxKm: number): Buoy | null {
  let best: Buoy | null = null;
  for (const r of rows) {
    if (!has(r)) continue;
    const d = km(lat, lon, r.lat, r.lon);
    if (d <= maxKm && (!best || d < best.km)) best = { ...r, km: Math.round(d) };
  }
  return best;
}

// ---------- tides ----------
const tideCache = new Map<string, { at: number; data: TideData }>();

async function tidesFor(lat: number, lon: number): Promise<TideData | null> {
  const stations = require('../data/tides.json') as [string, string, number, number][];
  let best: { id: string; name: string; km: number } | null = null;
  for (const s of stations) {
    const d = km(lat, lon, s[2], s[3]);
    if (d <= 60 && (!best || d < best.km)) best = { id: s[0], name: s[1], km: Math.round(d) };
  }
  if (!best) return null;
  const hit = tideCache.get(best.id);
  if (hit && Date.now() - hit.at < 3 * 3600 * 1000) return hit.data;
  const y = new Date(Date.now() - 36 * 3600 * 1000);
  const begin = y.getUTCFullYear() + String(y.getUTCMonth() + 1).padStart(2, '0') + String(y.getUTCDate()).padStart(2, '0');
  const json = JSON.parse(await getText(
    'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=surfplace' +
    '&begin_date=' + begin + '&range=240&datum=MLLW&station=' + best.id +
    '&time_zone=lst_ldt&units=metric&interval=hilo&format=json'));
  if (!json.predictions || !json.predictions.length) return null;
  const data: TideData = {
    station: best,
    hilo: json.predictions.map((p: { t: string; v: string; type: 'H' | 'L' }) => ({ t: p.t, v: +p.v, type: p.type })),
  };
  tideCache.set(best.id, { at: Date.now(), data });
  return data;
}

// Everything measured near a spot, or null if NOAA could not be reached at all.
export async function getLive(spot: Pick<Spot, 'lat' | 'lon'>): Promise<LiveData | null> {
  const out: LiveData = { buoy: null, wind: null, water: null, tide: null };
  let reached = false;
  try {
    const rows = await buoyRows();
    reached = true;
    out.buoy = nearest(rows, spot.lat, spot.lon, (r) => r.wvht !== null && (r.dpd !== null || r.apd !== null), 300);
    out.wind = nearest(rows, spot.lat, spot.lon, (r) => r.wspd !== null && r.wdir !== null, 50);
    out.water = nearest(rows, spot.lat, spot.lon, (r) => r.wtmp !== null, 120);
  } catch { /* buoys unavailable */ }
  try {
    out.tide = await tidesFor(spot.lat, spot.lon);
    if (out.tide) reached = true;
  } catch { /* tides unavailable */ }
  return reached ? out : null;
}
