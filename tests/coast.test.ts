import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoast, crossings, isLand, unwrap } from '../src/map/coast';

buildCoast(require('../src/data/land.json'));

// [name, lat, lon]
const LAND: [string, number, number][] = [
  ['Moscow', 55.75, 37.6], ['Kansas', 38, -98], ['Sahara', 23, 10], ['Tokyo', 35.7, 139.7], ['Australian outback', -25, 135],
  ['Greenland ice cap', 72, -40], ['Central Siberia', 66, 100], ['Yakutsk', 62, 129], ['Alaska north slope', 69, -150],
  ['Chukotka', 66, 170], ['Antarctica', -80, 0], ['East Antarctica plateau', -78, 90], ['Taymyr', 72, 100], ['Canadian tundra', 64, -105],
  ['Quebec', 52, -72], ['Long Island', 40.8, -73.2], ['Oahu', 21.45, -158], ['Brazil', -10, -55], ['Sweden', 62, 15], ['Fiji main island', -17.8, 178],
  ['Wrangel Island', 71.25, -179.5], ['Wrangel Island east half', 71.25, 179.6],
];
const SEA: [string, number, number][] = [
  ['Mid Atlantic', 30, -40], ['Mid Pacific', 0, -150], ['Arctic Ocean', 85, 0], ['Bering Sea', 60, -175], ['Kara Sea', 75, 70],
  ['Hudson Bay', 60, -85], ['Baffin Bay', 73, -65], ['Mediterranean', 35, 18], ['Gulf of Mexico', 25, -90], ['Atlantic off New York', 39.5, -72],
  ['Indian Ocean', -20, 80], ['Southern Ocean', -60, 100], ['Sea of Okhotsk', 55, 150], ['Laptev Sea', 76, 120], ['East Siberian Sea', 74, 160],
  ['Chukchi Sea', 70, -170], ['Pacific off California', 33, -125],
];

for (const [name, lat, lon] of LAND) test('land: ' + name, () => assert.equal(isLand(lat, lon), true));
for (const [name, lat, lon] of SEA) test('sea: ' + name, () => assert.equal(isLand(lat, lon), false));

test('every latitude row crosses the coast an even number of times (closed shapes only)', () => {
  const bad: string[] = [];
  for (let lat = -84.9; lat <= 84.9; lat += 0.0371) {
    if (crossings(lat).length & 1) bad.push(lat.toFixed(2));
  }
  assert.deepEqual(bad, [], 'rows with a broken land/sea fill: ' + bad.slice(0, 8).join(', '));
});

test('a ring crossing the date line is unwrapped into one continuous shape', () => {
  const p = unwrap([179, 65, 179.9, 66, -179.5, 66, -178, 65, 179, 65]);
  for (let i = 2; i < p.length; i += 2) assert.ok(Math.abs(p[i] - p[i - 2]) < 180, 'jump at point ' + i / 2);
});
