import test from 'node:test';
import assert from 'node:assert/strict';
import { clock, confidence, ForecastData, Hour, moonPhase, naiveMin, rate, tideAt, tideInfo, windows } from '../src/engine/forecast';
import { parseBuoys } from '../src/engine/live';
import { buildReport, buildDay, hourDetail } from '../src/engine/report';
import { pickNeighbours } from '../src/engine/nearby';
import { bodyHeight, dayName, rangeShort, sizeText } from '../src/engine/format';
import { Spot } from '../src/engine/types';

function hour(i: number, over: Partial<Hour> = {}): Hour {
  const h = i % 24;
  return {
    i, day: Math.floor(i / 24), hour: h, time: '2026-11-1' + (5 + Math.floor(i / 24)) + 'T' + String(h).padStart(2, '0') + ':00',
    H: 1.5, T: 10, D: 180, swH: 1.5, swT: 10, swD: 180, wwH: 0.1, wwT: 4, wwD: 180,
    sst: 15, tide: Math.sin(i / 2), wind: 8, windDir: 0, gust: 12, air: 12, code: 0, uv: 2, rain: 0,
    light: h >= 7 && h <= 17, dusk: h === 7 || h === 17, spread: 0.05, ...over,
  };
}
function data(hours: Hour[], now = 8): ForecastData {
  const days = [];
  for (let d = 0; d * 24 < hours.length; d++) days.push({ d, date: '2026-11-' + (15 + d), sun: { rise: 6.7, set: 16.5 } });
  return { hours, days, now, nowMin: naiveMin(hours[now].time), tz: 'EST', live: null, cal: null, hilo: null, tideName: '', modelCount: 3 };
}
const spot: Spot = { id: 'x', name: 'Test Beach', region: 'New York, USA', lat: 40.6, lon: -73.6, facing: 180 };

test('flat water is rated FLAT', () => {
  const r = rate(hour(0, { H: 0.2, swH: 0.1, wwH: 0.1 }), 180, 'intermediate');
  assert.equal(r?.label, 'FLAT');
});

test('clean waves with offshore wind rate high', () => {
  // beach faces south (180); wind from the north (0) is blowing out to sea
  const r = rate(hour(0, { swH: 1.4, swT: 13, wind: 9, windDir: 0 }), 180, 'intermediate');
  assert.equal(r?.wind.type, 'offshore');
  assert.ok(r && r.score >= 75, 'expected EPIC-level score, got ' + r?.score);
});

test('onshore wind ruins the same swell', () => {
  const off = rate(hour(0, { swH: 1.4, swT: 13, wind: 35, windDir: 0 }), 180, 'intermediate')!;
  const on = rate(hour(0, { swH: 1.4, swT: 13, wind: 35, windDir: 180 }), 180, 'intermediate')!;
  assert.equal(on.wind.type, 'onshore');
  assert.ok(on.score < off.score * 0.6, on.score + " vs " + off.score);
});

test('swell from behind the beach barely arrives', () => {
  const front = rate(hour(0, { swD: 180 }), 180, 'advanced')!;
  const behind = rate(hour(0, { swD: 0, D: 0 }), 180, 'advanced')!;
  assert.ok(behind.ft < front.ft / 5);
});

test('too big for a beginner, fine for an expert', () => {
  const big = hour(0, { swH: 3.2, swT: 12, H: 3.2 });
  assert.equal(rate(big, 180, 'beginner')?.label, 'TOO BIG');
  assert.notEqual(rate(big, 180, 'advanced')?.label, 'TOO BIG');
});

test('a custom spot (no facing) still rates, using wind strength only', () => {
  const r = rate(hour(0, { wind: 25 }), null, 'intermediate')!;
  assert.ok(['strong', 'breezy'].includes(r.wind.type));
});

test('windows pick the best daylight stretch, never the dark', () => {
  const hs: Hour[] = [];
  for (let i = 0; i < 48; i++) {
    // day 0: wind is bad until noon; at 3 AM the wind is perfect but it is dark
    const good = i === 3 || (i >= 12 && i <= 15);
    hs.push(hour(i, { windDir: good ? 0 : 180, wind: good ? 8 : 25 }));
  }
  const d = data(hs, 8);
  const { wins } = windows(d, 180, 'intermediate', d.now);
  const w = wins[0]!;
  assert.ok(w.a >= 12 && w.b <= 17, 'window ' + w.a + '-' + w.b + ' should be the 12-15 stretch');
  assert.ok(d.hours[w.a].light);
});

test('after dark, today has no window and tomorrow becomes the focus', () => {
  const hs: Hour[] = [];
  for (let i = 0; i < 48; i++) hs.push(hour(i));
  const d = data(hs, 20); // 8 PM
  const rep = buildReport(d, spot, 'intermediate', 'us');
  assert.equal(rep.focusDay, 1);
  assert.equal(rep.hero.when, 'TOMORROW');
});

test('buildReport gives a YES with facts, week and now rows', () => {
  const hs: Hour[] = [];
  for (let i = 0; i < 48; i++) hs.push(hour(i, { swH: 1.3, swT: 12, wind: 8, windDir: 0 }));
  const rep = buildReport(data(hs, 8), spot, 'intermediate', 'us');
  assert.ok(['yes', 'epic'].includes(rep.hero.verdict), 'verdict ' + rep.hero.verdict);
  assert.equal(rep.hero.facts.length, 3);
  assert.equal(rep.week.length, 2);
  const keys = rep.now.map((r) => r.k);
  for (const k of ['WAVES', 'SWELL', 'WIND', 'TIDE', 'WATER', 'AIR', 'SUN', 'MOON', 'BOARD']) assert.ok(keys.includes(k), 'missing row ' + k);
  const day = buildDay(data(hs, 8), rep.rated, rep.wins, 0);
  assert.equal(day.bars.length, 24);
  assert.ok(day.tide && day.tide.pts.length > 12);
  assert.ok(hourDetail(data(hs, 8), rep.rated, 10, 'us').title.includes('10 AM'));
});

test('flat week says no good surf', () => {
  const hs: Hour[] = [];
  for (let i = 0; i < 48; i++) hs.push(hour(i, { H: 0.2, swH: 0.1, wwH: 0.1 }));
  const rep = buildReport(data(hs, 8), spot, 'intermediate', 'us');
  assert.equal(rep.hero.verdict, 'no');
  assert.equal(rep.best.none, true);
});

test('time helpers', () => {
  assert.equal(clock(naiveMin('2026-11-15 06:21')), '6:21 AM');
  assert.equal(clock(naiveMin('2026-11-15 00:05')), '12:05 AM');
  assert.equal(clock(naiveMin('2026-11-15 23:59')), '11:59 PM');
  assert.equal(naiveMin('2026-11-15T07:00') - naiveMin('2026-11-15T06:00'), 60);
});

test('tide curve passes through highs and lows', () => {
  const pts = [
    { t: 0, v: 2, type: 'H' as const }, { t: 360, v: 0, type: 'L' as const }, { t: 720, v: 2, type: 'H' as const },
  ];
  assert.ok(Math.abs((tideAt(pts, 0) as number) - 2) < 1e-9);
  assert.ok(Math.abs((tideAt(pts, 180) as number) - 1) < 1e-9);
  assert.equal(tideAt(pts, 999), null);
});

test('real tide times drive rising / falling and the next turn', () => {
  const hs: Hour[] = [];
  for (let i = 0; i < 48; i++) hs.push(hour(i));
  const d = data(hs, 8);
  const base = naiveMin(hs[0].time);
  d.hilo = [
    { t: base + 2 * 60, v: 1.9, type: 'H' }, { t: base + 8 * 60 + 30, v: 0.2, type: 'L' }, { t: base + 14 * 60 + 40, v: 2.0, type: 'H' },
  ];
  const t = tideInfo(d, 8)!; // 8:00 AM: after the 2 AM high, heading to the 8:30 low
  assert.equal(t.rising, false);
  assert.equal(t.turn?.type, 'low');
  assert.equal(t.turn?.label, '8:30 AM');
});

test('confidence follows model agreement and drops for far-off days', () => {
  const hs: Hour[] = [];
  for (let i = 0; i < 24 * 7; i++) hs.push(hour(i, { spread: 0.05 }));
  assert.equal(confidence({ hours: hs }, 0).level, 3);
  assert.equal(confidence({ hours: hs }, 6).level, 2); // capped
  const wide: Hour[] = hs.map((h) => ({ ...h, spread: 0.6 }));
  assert.equal(confidence({ hours: wide }, 0).level, 1);
});

test('buoy file parsing keeps fresh rows and reads MM as missing', () => {
  const now = Date.UTC(2026, 10, 15, 5, 30);
  const text = [
    '#STN       LAT      LON  YYYY MM DD hh mm WDIR WSPD   GST WVHT  DPD APD MWD   PRES  PTDY  ATMP  WTMP  DEWP  VIS   TIDE',
    '#text      deg      deg   yr mo day hr mn degT  m/s   m/s   m   sec sec degT   hPa   hPa  degC  degC  degC  nmi     ft',
    '44025    40.258  -73.175 2026 11 15 04 40  MM    MM    MM  1.5   5  4.5 297     MM    MM    MM    MM    MM   MM     MM',
    '44065    40.368  -73.701 2026 11 15 05 10 300  12.0  16.0   MM  MM  3.7 300 1013.2    MM   8.2  15.1   3.3   MM     MM',
    '99999    10.000  -50.000 2026 11 14 01 00 300  12.0  16.0  2.0   8  3.7 300 1013.2    MM   8.2  15.1   3.3   MM     MM',
  ].join('\n');
  const rows = parseBuoys(text, now);
  assert.equal(rows.length, 2); // the day-old one is dropped
  assert.equal(rows[0].wvht, 1.5);
  assert.equal(rows[0].wspd, null);
  assert.equal(rows[1].wvht, null);
  assert.equal(rows[1].wtmp, 15.1);
});

test('moon phase matches known new and full moons', () => {
  const near = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b)) < 0.04;
  assert.ok(near(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14))), 0));
  assert.ok(near(moonPhase(new Date(Date.UTC(2000, 0, 21, 4, 40))), 0.5)); // total lunar eclipse
});

test('nearby picks close, distinct beaches only', () => {
  const mk = (id: string, name: string, lat: number, lon: number): Spot => ({ id, name, region: 'X', lat, lon, facing: 180 });
  const here = mk('a', 'Here', 40.6, -73.6);
  const all = [here, mk('b', 'Next', 40.62, -73.6), mk('c', 'Next dup', 40.6205, -73.6), mk('d', 'Far', 41.9, -73.6), mk('e', 'Other', 40.6, -73.7)];
  const out = pickNeighbours(all, here, 5, 60).map((x) => x.spot.id);
  assert.deepEqual(out, ['b', 'e']); // 'c' is within 2.5 km of 'b'; 'd' is too far
});

test('wording helpers', () => {
  assert.equal(bodyHeight(0.5), 'no');
  assert.equal(bodyHeight(3.5), 'waist-high');
  assert.equal(sizeText(1.0, 'us'), '3-4 ft');
  assert.equal(sizeText(0.1, 'us'), 'Flat');
  const d = data(Array.from({ length: 48 }, (_, i) => hour(i)));
  assert.equal(dayName(d, 0), 'TODAY');
  assert.equal(dayName(d, 1, true), 'TOMORROW');
  const w = { a: 10, b: 14 };
  assert.equal(rangeShort(d, w), '10–2 AM'.replace('2 AM', '2 PM').replace('10–2 PM', '10 AM–2 PM'));
});
