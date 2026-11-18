import test from 'node:test';
import assert from 'node:assert/strict';
import { Hour } from '../src/engine/forecast';
import { ratingReasons, swellTrains } from '../src/engine/detail';
import { rate } from '../src/engine/forecast';
import { ForecastData } from '../src/engine/forecast';

function hour(over: Partial<Hour> = {}): Hour {
  return {
    i: 10, day: 0, hour: 10, time: '2026-11-18T10:00',
    H: 1.5, T: 11, D: 200, swH: 1.4, swT: 12, swD: 200, sw2H: null, sw2T: null, sw2D: null,
    wwH: 0.3, wwT: 4, wwD: 180, sst: 18, tide: 0.5,
    wind: 8, windDir: 20, gust: 12, air: 15, code: 0, uv: 3, rain: 0, light: true, dusk: false, ...over,
  };
}

test('swell trains list the primary, a real secondary, and wind chop, biggest energy first', () => {
  const t = swellTrains(hour({ swH: 1.4, swT: 12, swD: 200, sw2H: 0.9, sw2T: 9, sw2D: 90, wwH: 0.4, wwT: 4 }), 'us');
  assert.equal(t.length, 3);
  assert.equal(t[0].kind, 'primary');
  assert.equal(t[0].main, true);
  assert.ok(t.some((x) => x.kind === 'secondary'));
  assert.ok(t.some((x) => x.kind === 'windchop'));
});

test('a tiny secondary swell is left out', () => {
  const t = swellTrains(hour({ sw2H: 0.05, wwH: 0 }), 'us');
  assert.deepEqual(t.map((x) => x.kind), ['primary']);
});

test('reasons explain a clean long-period session positively', () => {
  const h = hour({ swH: 1.4, swT: 13, wind: 14, windDir: 20 }); // beach faces 200, wind from 20 = offshore
  const r = rate(h, 200, 'intermediate');
  const data = { hours: [h] } as unknown as ForecastData;
  const reasons = ratingReasons({ ...data, hours: [h] } as ForecastData, 0, [r], 'us');
  assert.ok(reasons.some((x) => x.good && /offshore/i.test(x.text)));
  assert.ok(reasons.some((x) => x.good && /period/i.test(x.text)));
});

test('reasons flag onshore wind and short period as bad', () => {
  const h = hour({ swH: 1.2, swT: 6, wind: 22, windDir: 200 }); // wind from 200 into a 200-facing beach = onshore
  const r = rate(h, 200, 'intermediate');
  const reasons = ratingReasons({ hours: [h] } as ForecastData, 0, [r], 'us');
  assert.ok(reasons.some((x) => !x.good && /messy|onshore/i.test(x.text)));
  assert.ok(reasons.some((x) => !x.good && /short/i.test(x.text)));
});

test('flat water gives a single flat reason', () => {
  const h = hour({ H: 0.1, swH: 0.1, sw2H: 0, wwH: 0.1 });
  const r = rate(h, 200, 'intermediate');
  const reasons = ratingReasons({ hours: [h] } as ForecastData, 0, [r], 'us');
  assert.equal(reasons.length, 1);
  assert.equal(reasons[0].good, false);
});
