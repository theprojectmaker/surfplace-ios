// "Nearby beaches": how the closest breaks compare right now, from ONE batched request per
// model (Open-Meteo answers a list of coordinates in a single call).
import { Skill, Spot } from './types';
import { km } from './live';
import { Hour, Label, Cls, rate } from './forecast';

const MARINE = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER = 'https://api.open-meteo.com/v1/forecast';

export type NearbySpot = {
  spot: Spot; km: number;
  /** estimated surf now, feet */ ft: number; label: Label; cls: Cls; score: number;
  /** best score in the next 24 h, and the hour (0-23, local) it happens */ bestScore: number; bestHour: number; bestFt: number;
};

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

// the closest spots to `spot`, skipping near-duplicates (same stretch of sand)
export function pickNeighbours(all: Spot[], spot: Spot, count: number, maxKm: number): { spot: Spot; km: number }[] {
  const found = all
    .filter((b) => b.id !== spot.id && !(b.name === spot.name && b.region === spot.region))
    .map((b) => ({ spot: b, km: km(spot.lat, spot.lon, b.lat, b.lon) }))
    .filter((x) => x.km <= maxKm && x.km >= 1.2)
    .sort((a, b) => a.km - b.km);
  const out: { spot: Spot; km: number }[] = [];
  for (const f of found) {
    if (out.some((o) => km(o.spot.lat, o.spot.lon, f.spot.lat, f.spot.lon) < 2.5)) continue;
    out.push(f);
    if (out.length >= count) break;
  }
  return out;
}

export async function loadNearby(all: Spot[], spot: Spot, skill: Skill): Promise<NearbySpot[]> {
  const near = pickNeighbours(all, spot, 6, 90);
  if (!near.length) return [];
  const lat = near.map((n) => n.spot.lat).join(',');
  const lon = near.map((n) => n.spot.lon).join(',');
  const q = 'latitude=' + lat + '&longitude=' + lon + '&timezone=auto&forecast_days=2';
  const get = async (url: string) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('status ' + r.status);
      const j = await r.json();
      return Array.isArray(j) ? j : [j];
    } finally { clearTimeout(timer); }
  };
  const [ms, ws] = await Promise.all([
    get(MARINE + '?' + q + '&cell_selection=sea&hourly=wave_height,wave_period,wave_direction,swell_wave_height,' +
      'swell_wave_period,swell_wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction'),
    get(WEATHER + '?' + q + '&hourly=wind_speed_10m,wind_direction_10m'),
  ]);
  const out: NearbySpot[] = [];
  near.forEach((nb, idx) => {
    const m = ms[idx], w = ws[idx];
    if (!m || !m.hourly || !w || !w.hourly) return;
    const mh = m.hourly, wh = w.hourly;
    const local = new Date(Date.now() + (m.utc_offset_seconds || 0) * 1000);
    let now = mh.time.indexOf(local.toISOString().slice(0, 13) + ':00');
    if (now < 0) now = 0;
    let first: ReturnType<typeof rate> = null, best: { score: number; hour: number; ft: number } | null = null;
    for (let i = now; i < Math.min(now + 24, mh.time.length); i++) {
      const h = {
        H: num(mh.wave_height[i]), T: num(mh.wave_period[i]), D: num(mh.wave_direction[i]),
        swH: num(mh.swell_wave_height[i]), swT: num(mh.swell_wave_period[i]), swD: num(mh.swell_wave_direction[i]),
        wwH: num(mh.wind_wave_height[i]), wwT: num(mh.wind_wave_period[i]), wwD: num(mh.wind_wave_direction[i]),
        wind: num(wh.wind_speed_10m[i]) || 0, windDir: num(wh.wind_direction_10m[i]) || 0,
      } as Hour;
      const r = rate(h, nb.spot.facing, skill);
      if (!r) continue;
      if (!first) first = r;
      const hour = +mh.time[i].slice(11, 13);
      const daylight = hour >= 6 && hour <= 19;
      if (daylight && (!best || r.score > best.score)) best = { score: r.score, hour, ft: r.ft };
    }
    if (!first) return;
    out.push({
      spot: nb.spot, km: nb.km, ft: first.ft, label: first.label, cls: first.cls, score: first.score,
      bestScore: best ? best.score : first.score, bestHour: best ? best.hour : 12, bestFt: best ? best.ft : first.ft,
    });
  });
  // best first; the user can tap one to open its full forecast
  return out.sort((a, b) => b.bestScore - a.bestScore || a.km - b.km);
}

export type SpotNow = {
  spot: Spot;
  ft: number; label: Label; cls: Cls; score: number;
  bestScore: number; bestHour: number; bestFt: number; bestLabel: Label; bestCls: Cls;
};

// Rank a given list of beaches (your saved spots) by how they look today, in ONE batched request.
// Open-Meteo answers up to ~100 coordinates at once, which covers any sensible favourites list.
export async function loadSpots(spots: Spot[], skill: Skill): Promise<SpotNow[]> {
  const list = spots.slice(0, 60);
  if (!list.length) return [];
  const lat = list.map((b) => b.lat).join(',');
  const lon = list.map((b) => b.lon).join(',');
  const q = 'latitude=' + lat + '&longitude=' + lon + '&timezone=auto&forecast_days=2';
  const get = async (url: string) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('status ' + r.status);
      const j = await r.json();
      return Array.isArray(j) ? j : [j];
    } finally { clearTimeout(timer); }
  };
  const [ms, ws] = await Promise.all([
    get(MARINE + '?' + q + '&cell_selection=sea&hourly=wave_height,wave_period,wave_direction,swell_wave_height,' +
      'swell_wave_period,swell_wave_direction,secondary_swell_wave_height,secondary_swell_wave_period,' +
      'secondary_swell_wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction'),
    get(WEATHER + '?' + q + '&hourly=wind_speed_10m,wind_direction_10m'),
  ]);
  const out: SpotNow[] = [];
  list.forEach((sp, idx) => {
    const m = ms[idx], w = ws[idx];
    if (!m || !m.hourly || !w || !w.hourly) return;
    const mh = m.hourly, wh = w.hourly;
    const local = new Date(Date.now() + (m.utc_offset_seconds || 0) * 1000);
    let now = mh.time.indexOf(local.toISOString().slice(0, 13) + ':00');
    if (now < 0) now = 0;
    let first: ReturnType<typeof rate> = null;
    let best: { score: number; hour: number; ft: number; label: Label; cls: Cls } | null = null;
    for (let i = now; i < Math.min(now + 24, mh.time.length); i++) {
      const h = {
        H: num(mh.wave_height[i]), T: num(mh.wave_period[i]), D: num(mh.wave_direction[i]),
        swH: num(mh.swell_wave_height[i]), swT: num(mh.swell_wave_period[i]), swD: num(mh.swell_wave_direction[i]),
        sw2H: num(mh.secondary_swell_wave_height && mh.secondary_swell_wave_height[i]),
        sw2T: num(mh.secondary_swell_wave_period && mh.secondary_swell_wave_period[i]),
        sw2D: num(mh.secondary_swell_wave_direction && mh.secondary_swell_wave_direction[i]),
        wwH: num(mh.wind_wave_height[i]), wwT: num(mh.wind_wave_period[i]), wwD: num(mh.wind_wave_direction[i]),
        wind: num(wh.wind_speed_10m[i]) || 0, windDir: num(wh.wind_direction_10m[i]) || 0,
      } as Hour;
      const r = rate(h, sp.facing, skill);
      if (!r) continue;
      if (!first) first = r;
      const hour = +mh.time[i].slice(11, 13);
      if (hour >= 6 && hour <= 19 && (!best || r.score > best.score)) best = { score: r.score, hour, ft: r.ft, label: r.label, cls: r.cls };
    }
    if (!first) return;
    out.push({
      spot: sp, ft: first.ft, label: first.label, cls: first.cls, score: first.score,
      bestScore: best ? best.score : first.score, bestHour: best ? best.hour : 12, bestFt: best ? best.ft : first.ft,
      bestLabel: best ? best.label : first.label, bestCls: best ? best.cls : first.cls,
    });
  });
  return out.sort((a, b) => b.bestScore - a.bestScore);
}

