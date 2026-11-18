// Richer read-outs for the forecast screen: the individual swell trains, a plain explanation of
// why a session is rated the way it is, and the next good window across the week. All pure.
import { confidence, ForecastData, Rating, Win, M2FT } from './forecast';
import { bodyHeight, compass, compassShort, height, rangeShort, speed, swellPower } from './format';
import { dayName } from './format';
import { Hour } from './forecast';
import { Units } from './types';

export type SwellTrain = {
  kind: 'primary' | 'secondary' | 'windchop';
  heightM: number; period: number; dir: number;
  label: string; from: string; power: string; main: boolean;
};

// The separate swell trains hitting the beach this hour, biggest first. A surfer reads this to
// know whether the energy is one clean long-period groundswell or a messy mix.
export function swellTrains(h: Hour, units: Units): SwellTrain[] {
  const out: SwellTrain[] = [];
  const add = (kind: SwellTrain['kind'], hM: number | null | undefined, t: number | null | undefined, d: number | null | undefined, label: string) => {
    if (hM == null || hM < 0.15 || t == null) return;
    out.push({ kind, heightM: hM, period: t, dir: d ?? 0, label, from: compass(d ?? 0), power: swellPower(hM, t), main: false });
  };
  add('primary', h.swH, h.swT, h.swD, 'Primary swell');
  add('secondary', h.sw2H, h.sw2T, h.sw2D, 'Second swell');
  add('windchop', h.wwH, h.wwT, h.wwD, 'Wind chop');
  out.sort((a, b) => b.heightM * b.period - a.heightM * a.period);
  if (out.length) out[0].main = true;
  return out;
}

// e.g. "4.2 ft at 13s from the west"
export function trainText(t: SwellTrain, units: Units): string {
  return height(t.heightM, units) + ' at ' + Math.round(t.period) + 's from the ' + t.from;
}

export type Reason = { good: boolean; text: string };

// Why this session is rated as it is: size, wind, period/power, tide direction, crowd-free dawn.
export function ratingReasons(data: ForecastData, i: number, rated: (Rating | null)[], units: Units): Reason[] {
  const h = data.hours[i], r = rated[i];
  if (!r) return [];
  const out: Reason[] = [];
  const ft = r.ft;
  if (ft < 1) { out.push({ good: false, text: 'No rideable waves — it is flat' }); return out; }

  // size
  if (r.tooBig) out.push({ good: false, text: 'Too big for your level (' + bodyHeight(ft) + ')' });
  else if (ft >= 2 && ft <= 8) out.push({ good: true, text: 'Good size: ' + bodyHeight(ft) + ' waves' });
  else if (ft < 2) out.push({ good: false, text: 'Small: only ' + bodyHeight(ft) });
  else out.push({ good: true, text: 'Big: ' + bodyHeight(ft) + ' — for strong surfers' });

  // wind
  const w = r.wind;
  if (w.type === 'glassy') out.push({ good: true, text: 'Glassy — no wind to mess up the face' });
  else if (w.type === 'offshore') out.push({ good: true, text: 'Offshore wind holds the wave face up clean' });
  else if (w.type === 'cross-offshore') out.push({ good: true, text: 'Wind mostly offshore — fairly clean' });
  else if (w.type === 'onshore') out.push({ good: false, text: 'Onshore wind (' + speed(h.wind, units) + ') makes it messy' });
  else out.push({ good: false, text: 'Cross/side wind adds some bump' });

  // period / power
  if (r.period >= 12) out.push({ good: true, text: 'Long ' + Math.round(r.period) + 's period — powerful, lined-up sets' });
  else if (r.period >= 9) out.push({ good: true, text: 'Decent ' + Math.round(r.period) + 's period swell' });
  else out.push({ good: false, text: 'Short ' + Math.round(r.period) + 's period — weak, close-together waves' });

  // tide trend (if known)
  if (h.tide != null) {
    const nx = data.hours[i + 1]?.tide;
    if (nx != null) out.push({ good: true, text: (nx > h.tide ? 'Tide pushing in' : 'Tide dropping') + ' — watch how your break likes it' });
  }

  // dawn bonus
  if (h.light && h.hour <= 8) out.push({ good: true, text: 'Early — cleanest wind and fewer people' });
  return out;
}

export type Alert = { text: string; sub: string; cls: Rating['cls'] } | null;

// The best window anywhere in the week that is clearly worth a special mention.
export function nextBig(data: ForecastData, wins: (Win | null)[], units: Units): Alert {
  let best: Win | null = null;
  const trust = (w: Win) => w.score * (w.d < 3 ? 1 : w.d < 5 ? 0.9 : 0.8);
  for (const w of wins) if (w && (w.label === 'EPIC' || w.label === 'GOOD') && (!best || trust(w) > trust(best))) best = w;
  if (!best) return null;
  const conf = confidence(data, best.d);
  const when = (best.d === 0 ? 'Today' : best.d === 1 ? 'Tomorrow' : dayName(data, best.d).replace(/^(.)(.*)$/, (_m, a, b) => a + b.toLowerCase()));
  return {
    text: when + ' ' + rangeShort(data, best) + ' looks ' + (best.label === 'EPIC' ? 'epic' : 'good'),
    sub: bodyHeight(best.ft) + ' · ' + Math.round(best.period) + 's · ' + ['', 'rough guess', 'likely', 'very likely'][conf.level],
    cls: best.cls,
  };
}

export { M2FT, compassShort };
