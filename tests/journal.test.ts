import test from 'node:test';
import assert from 'node:assert/strict';
import { byMonth, daysBetween, Session, stats, todayISO } from '../src/engine/journal';

const mk = (date: string, spot: string, stars: number, sizeFt: number): Session =>
  ({ id: date + spot, date, spot, region: 'X', stars, sizeFt, board: 'shortboard', notes: '' });

test('no sessions gives empty stats', () => {
  const s = stats([]);
  assert.equal(s.total, 0);
  assert.equal(s.streak, 0);
  assert.equal(s.best, null);
  assert.equal(s.avgStars, 0);
});

test('counts, average and top spot', () => {
  const now = new Date(2026, 10, 18); // Nov 2026
  const s = stats([
    mk('2026-11-18', 'Long Beach', 4, 3),
    mk('2026-11-15', 'Long Beach', 5, 4),
    mk('2026-10-30', 'Pipeline', 2, 8),
    mk('2025-12-01', 'Lido', 3, 2),
  ], now);
  assert.equal(s.total, 4);
  assert.equal(s.thisMonth, 2);  // the two November sessions
  assert.equal(s.thisYear, 3);   // 2026
  assert.equal(s.topSpot?.name, 'Long Beach');
  assert.equal(s.topSpot?.count, 2);
  assert.equal(s.distinctSpots, 3);
  assert.ok(Math.abs(s.avgStars - 3.5) < 1e-9);
  assert.equal(s.best?.stars, 5);
  assert.equal(s.biggest?.sizeFt, 8);
  assert.equal(s.lastDate, '2026-11-18');
});

test('streak counts consecutive days up to the most recent session', () => {
  const now = new Date(2026, 10, 18);
  const s = stats([
    mk('2026-11-18', 'A', 3, 3),
    mk('2026-11-17', 'A', 3, 3),
    mk('2026-11-16', 'B', 3, 3),
    mk('2026-11-13', 'B', 3, 3), // gap breaks it
  ], now);
  assert.equal(s.streak, 3);
});

test('two sessions same day count once toward the streak', () => {
  const s = stats([mk('2026-11-18', 'A', 3, 3), mk('2026-11-18', 'B', 4, 5), mk('2026-11-17', 'A', 3, 3)]);
  assert.equal(s.streak, 2);
  assert.equal(s.total, 3);
});

test('daysBetween and todayISO', () => {
  assert.equal(daysBetween('2026-11-15', '2026-11-18'), 3);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1); // 2026 not a leap year
  assert.match(todayISO(new Date(2026, 0, 5)), /^2026-01-05$/);
});

test('byMonth groups newest month and newest session first', () => {
  const g = byMonth([mk('2026-10-01', 'A', 3, 3), mk('2026-11-18', 'B', 3, 3), mk('2026-11-02', 'C', 3, 3)]);
  assert.deepEqual(g.map((x) => x.month), ['2026-11', '2026-10']);
  assert.deepEqual(g[0].items.map((x) => x.date), ['2026-11-18', '2026-11-02']);
});
