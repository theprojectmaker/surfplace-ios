// Turns a forecast into exactly what the screens show, in plain language: the big yes/no
// answer, the best day, the right-now rows, the week, per-day detail and the trust notes.
import {
  Cls, confidence, ForecastData, moonPhase, Rating, rate, tideInfo, WindType, Win, windows, naiveMin, clock, M2FT,
} from './forecast';
import {
  ago, board, bodyHeight, cap, CHIP, compass, compassShort, dateText, dayName, dist, height, hourLabel, moonName, rangeShort,
  sizeText, speed, suit, sunTime, SURE, swellPower, temp, tideStrength, uvWord, weather, windPlain, WIND_WHY, WIND_WORD,
} from './format';
import { Skill, Spot, Units } from './types';

export type Verdict = 'epic' | 'yes' | 'maybe' | 'no';
export type Fact = { k: string; v: string; sub?: string };
export type Row = { k: string; v: string; sub: string; arrow?: number };
export type WeekItem = { d: number; name: string; date: string; cls: Cls; chip: string; size: string; time: string; good: boolean; conf: string };
export type Bar = { i: number; label: string; ft: number; cls: Cls; light: boolean };
export type DayDetail = {
  bars: Bar[]; maxFt: number;
  tide: { pts: { x: number; y: number }[]; marks: { x: number; type: 'high' | 'low'; label: string; v: string }[]; real: boolean } | null;
  defaultHour: number;
};
export type Hero = {
  when: string; word: string; why: string; cls: Cls; verdict: Verdict; facts: Fact[];
  ft: number; wind: WindType; mph: number; dusk: boolean; score: number;
};
export type Report = {
  focusDay: number;
  hero: Hero;
  best: { main: string; sub: string; none: boolean; day: number };
  now: Row[];
  week: WeekItem[];
  trust: { k: string; text: string; link?: string }[];
  rated: (Rating | null)[];
  wins: (Win | null)[];
};

export function buildReport(data: ForecastData, spot: Spot, skill: Skill, units: Units): Report {
  const { rated, wins } = windows(data, spot.facing, skill, data.now);
  const focusDay = wins[0] ? 0 : 1;
  return {
    focusDay,
    hero: buildHero(data, wins, focusDay, units),
    best: buildBest(data, wins, focusDay, units),
    now: buildNow(data, rated, wins, focusDay, skill, units),
    week: buildWeek(data, wins, units),
    trust: buildTrust(data, spot, units),
    rated,
    wins,
  };
}

function buildHero(data: ForecastData, wins: (Win | null)[], fd: number, units: Units): Hero {
  const when = fd === 0 ? 'TODAY' : 'TOMORROW';
  const w = wins[fd];
  if (!w) {
    return { when, word: 'NO DATA', why: 'There is no forecast for this spot right now.', cls: 'flat', verdict: 'no', facts: [], ft: 0, wind: 'glassy', mph: 0, dusk: false, score: 0 };
  }
  let word: string, why: string, verdict: Verdict;
  if (w.label === 'FLAT') { word = 'NO'; why = 'It is flat. No waves to ride.'; verdict = 'no'; }
  else if (w.label === 'TOO BIG') { word = 'NO'; why = 'Too big for your level. Watch from the beach.'; verdict = 'no'; }
  else if (w.label === 'POOR') {
    word = 'NOT REALLY'; verdict = 'no';
    why = w.wind.q < 0.5 ? 'There are waves, but the wind is making them messy.' : 'The waves are small and weak.';
  }
  else if (w.label === 'FAIR') { word = 'MAYBE'; why = 'It is OK. Not great, but rideable.'; verdict = 'maybe'; }
  else if (w.label === 'GOOD') { word = 'YES'; why = 'Good waves. Go surf.'; verdict = 'yes'; }
  else { word = 'YES! GO!'; why = 'It does not get better than this.'; verdict = 'epic'; }
  const facts: Fact[] = w.ft < 1 ? [] : [
    { k: 'BEST TIME', v: rangeShort(data, w) },
    { k: 'WAVES', v: sizeText(w.ft / M2FT, units), sub: bodyHeight(w.ft) },
    { k: 'WIND', v: WIND_WORD[w.wind.type], sub: speed(w.wind.mph * 1.609344, units) },
  ];
  return {
    when, word, why, cls: w.cls, verdict, facts, ft: w.ft, wind: w.wind.type, mph: w.wind.mph,
    dusk: data.hours[w.a].dusk, score: Math.round(w.score),
  };
}

function buildBest(data: ForecastData, wins: (Win | null)[], fd: number, units: Units): Report['best'] {
  // far-off days are less certain, so they have to win by more
  const trust = (w: Win) => w.score * (w.d < 3 ? 1 : w.d < 5 ? 0.92 : 0.82);
  let top: Win | null = null;
  for (const w of wins) if (w && (!top || trust(w) > trust(top) + 3)) top = w;
  if (!top || top.score < 30 || top.label === 'TOO BIG') {
    return { main: 'NO GOOD SURF THIS WEEK', sub: 'Nothing worth it in the next 7 days here. Try another beach.', none: true, day: fd };
  }
  if (top.d === fd) {
    return { main: (fd === 0 ? 'TODAY' : 'TOMORROW') + ' IS THE ONE', sub: 'Nothing better is coming in the next 7 days.', none: false, day: top.d };
  }
  const conf = confidence(data, top.d);
  return {
    main: dayName(data, top.d, true) + ', ' + rangeShort(data, top),
    sub: cap(bodyHeight(top.ft)) + ' waves (' + sizeText(top.ft / M2FT, units).toLowerCase() + '), ' +
      WIND_WORD[top.wind.type].toLowerCase() + ' wind. ' + SURE[conf.level] + '.',
    none: false, day: top.d,
  };
}

function buildNow(data: ForecastData, rated: (Rating | null)[], wins: (Win | null)[], fd: number, skill: Skill, units: Units): Row[] {
  const i = data.now, h = data.hours[i], r = rated[i];
  if (!r) return [];
  const rows: Row[] = [];
  const lv = data.live;
  const fw = wins[fd];
  const bd = board(fw ? fw.ft : r.ft, skill);

  rows.push({
    k: 'WAVES', v: r.ft < 1 ? 'Flat' : sizeText(r.m, units),
    sub: r.ft < 1 ? 'Nothing to ride' : cap(bodyHeight(r.ft)) + ' at the beach · surf score ' + r.score + '/100',
  });

  // the swell itself: height, period, where it comes from, how strong
  const swH = h.swH !== null ? h.swH : h.H, swT = h.swH !== null ? h.swT : h.T, swD = h.swH !== null ? h.swD : h.D;
  if (swH !== null && swT !== null) {
    const chop = h.swH !== null && h.wwH !== null && h.wwH >= 0.25 ? ' + ' + height(h.wwH, units) + ' of wind chop' : '';
    rows.push({
      k: 'SWELL', v: height(swH, units) + ' at ' + Math.round(swT) + 's',
      sub: (swD !== null ? 'From the ' + compass(swD) + ' · ' : '') + swellPower(swH, swT) + ' swell' + chop +
        (swT >= 12 ? '. Long period: it pushes more than the size says' : swT < 7 ? '. Short period: weak, bumpy waves' : ''),
      arrow: swD !== null ? swD : undefined,
    });
  }

  rows.push({
    k: 'WIND', v: WIND_WORD[r.wind.type],
    sub: WIND_WHY[r.wind.type] + ', ' + speed(h.wind, units) + ' from the ' + compassShort(h.windDir) +
      (h.gust - h.wind >= 8 ? ' · gusts ' + speed(h.gust, units) : ''),
    arrow: h.windDir,
  });

  const tide = tideInfo(data, i);
  rows.push({
    k: 'TIDE', v: tide ? (tide.rising ? 'Coming in' : 'Going out') : '--',
    sub: tide ? (tide.turn ? cap(tide.turn.type) + ' tide at ' + tide.turn.label : '') : 'No tide information here',
  });

  const measured = !!(lv && lv.water && lv.water.wtmp !== null && Math.abs(i - data.now) <= 48);
  const water = measured ? (lv!.water!.wtmp as number) : h.sst;
  rows.push({ k: 'WATER', v: temp(water, units), sub: cap(suit(water)) + (measured ? ' (measured)' : '') });

  const bits = [cap(weather(h.code))];
  if (h.uv !== null && h.uv >= 1 && h.light) bits.push('UV ' + Math.round(h.uv) + ' (' + uvWord(h.uv) + ')');
  if (h.rain !== null && h.rain >= 20) bits.push(Math.round(h.rain) + '% chance of rain');
  if (!h.light) bits.push('dark right now');
  rows.push({ k: 'AIR', v: temp(h.air, units), sub: bits.join(' · ') });

  const sun = data.days[0].sun;
  rows.push({ k: 'SUN', v: 'Up ' + sunTime(sun.rise), sub: 'Sets ' + sunTime(sun.set) + '. Surf in daylight' });

  const phase = moonPhase(new Date());
  rows.push({ k: 'MOON', v: moonName(phase), sub: tideStrength(phase) });

  rows.push({ k: 'BOARD', v: bd[0], sub: bd[1] });
  return rows;
}

function buildWeek(data: ForecastData, wins: (Win | null)[], units: Units): WeekItem[] {
  return data.days.map((day) => {
    const w = wins[day.d];
    const good = !!w && w.score >= 30 && w.label !== 'TOO BIG';
    return {
      d: day.d, name: dayName(data, day.d), date: dateText(data, day.d),
      cls: w ? w.cls : 'flat', chip: w ? CHIP[w.label] : 'DARK',
      size: w ? sizeText(w.ft / M2FT, units) : 'Day is over',
      time: good && w ? rangeShort(data, w) : '', good,
      conf: SURE[confidence(data, day.d).level],
    };
  });
}

// ---------- one day, hour by hour ----------
export function buildDay(data: ForecastData, rated: (Rating | null)[], wins: (Win | null)[], d: number): DayDetail {
  const start = d * 24;
  const bars: Bar[] = [];
  let maxFt = 4;
  for (let i = start; i < start + 24 && i < data.hours.length; i++) {
    const r = rated[i];
    if (r && r.ft > maxFt) maxFt = r.ft;
    bars.push({ i, label: hourLabel(data.hours[i].hour), ft: r ? r.ft : 0, cls: r ? r.cls : 'flat', light: data.hours[i].light });
  }
  maxFt *= 1.08;
  const w = wins[d];
  const defaultHour = w ? w.a : d === 0 ? data.now : start + 12;
  return { bars, maxFt, tide: buildTideDay(data, d), defaultHour };
}

function buildTideDay(data: ForecastData, d: number): DayDetail['tide'] {
  const start = d * 24, end = Math.min(start + 24, data.hours.length);
  const vals: number[] = [];
  for (let i = start; i < end; i++) { const t = data.hours[i].tide; if (t !== null) vals.push(t); }
  if (vals.length < 12) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(hi - lo, 0.05);
  const pts: { x: number; y: number }[] = [];
  for (let i = start; i < end; i++) {
    const t = data.hours[i].tide;
    if (t !== null) pts.push({ x: (i - start) / 23, y: (t - lo) / span });
  }
  const marks: { x: number; type: 'high' | 'low'; label: string; v: string }[] = [];
  const day0 = naiveMin(data.hours[start].time);
  if (data.hilo) {
    for (const p of data.hilo) {
      if (p.t >= day0 && p.t < day0 + 1440) {
        marks.push({ x: (p.t - day0) / 1380, type: p.type === 'H' ? 'high' : 'low', label: clock(p.t), v: p.v.toFixed(1) });
      }
    }
  } else {
    for (let i = start + 1; i < end - 1; i++) {
      const a = data.hours[i - 1].tide, b = data.hours[i].tide, c = data.hours[i + 1].tide;
      if (a === null || b === null || c === null) continue;
      if (b > a && b >= c) marks.push({ x: (i - start) / 23, type: 'high', label: clock(data.hours[i].hour * 60), v: b.toFixed(1) });
      if (b < a && b <= c) marks.push({ x: (i - start) / 23, type: 'low', label: clock(data.hours[i].hour * 60), v: b.toFixed(1) });
    }
  }
  return { pts, marks, real: !!data.hilo };
}

export function hourDetail(data: ForecastData, rated: (Rating | null)[], i: number, units: Units): { title: string; lines: string[] } {
  const h = data.hours[i], r = rated[i];
  if (!r) return { title: hourLabel(h.hour), lines: ['No forecast for this hour.'] };
  const lines: string[] = [];
  lines.push((r.ft < 1 ? 'Flat. ' : cap(sizeText(r.m, units)) + ', ' + bodyHeight(r.ft) + '. ') + cap(windPlain(r.wind)) + '.');
  const swH = h.swH !== null ? h.swH : h.H, swT = h.swH !== null ? h.swT : h.T;
  const parts: string[] = [];
  if (swH !== null && swT !== null) parts.push('Swell ' + height(swH, units) + ' at ' + Math.round(swT) + 's');
  parts.push('wind ' + speed(h.wind, units) + ' ' + compassShort(h.windDir));
  const t = h.tide;
  if (t !== null) parts.push('tide ' + (t >= 0 ? '+' : '') + height(t, units));
  parts.push(temp(h.air, units));
  lines.push(parts.join(' · '));
  if (!h.light) lines.push('Dark outside.');
  return { title: hourLabel(h.hour) + ' — ' + CHIP[r.label] + ' · score ' + r.score, lines };
}

function buildTrust(data: ForecastData, spot: Spot, units: Units): Report['trust'] {
  const out: Report['trust'] = [];
  const lv = data.live;
  if (lv && lv.buoy && lv.buoy.wvht !== null) {
    const b = lv.buoy;
    out.push({
      k: 'REAL MEASUREMENT',
      text: 'NOAA buoy ' + b.id + ', ' + dist(b.km, units) + ' from this beach, measured ' + height(b.wvht as number, units) + ' waves ' + ago(b.time) + '.',
      link: 'https://www.ndbc.noaa.gov/station_page.php?station=' + b.id,
    });
    if (data.cal) {
      const off = Math.round((data.cal.raw - 1) * 100);
      out.push({
        k: 'FORECAST CHECK',
        text: Math.abs(off) <= 8
          ? 'The forecast matched the buoy. It is on target right now.'
          : 'The forecast was ' + Math.abs(off) + '% too ' + (off > 0 ? 'small' : 'big') + ' compared with the buoy, so today and tomorrow have been corrected.',
      });
    }
  } else if (lv) {
    out.push({ k: 'NO BUOY NEARBY', text: 'No wave buoy is reporting near this beach, so this is forecast only. Treat it as a guide.' });
  } else {
    out.push({ k: 'NO LIVE DATA', text: 'Live buoy and tide readings could not be reached just now, so this is forecast only. Pull down to refresh.' });
  }
  out.push({
    k: 'TIDES',
    text: data.hilo ? 'Official NOAA tide times from ' + data.tideName + '.' : 'Estimated from an ocean model. Times can be off by an hour or so.',
  });
  out.push({
    k: 'WAVES AND WIND',
    text: data.modelCount > 1
      ? data.modelCount + ' separate wave forecasts are compared. When they agree a day is marked "very likely", when they disagree it is a "rough guess".'
      : 'One wave forecast is available here, so later days are a rough guess.',
  });
  out.push({
    k: 'KEEP IN MIND',
    text: 'Wave size at the beach is an estimate' + (spot.custom ? ', and a custom spot does not know which way the beach faces' : '') +
      '. The next 3 days are the most reliable.',
  });
  return out;
}

export { rate };
