import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestSpot, youLine } from '../src/engine/where';
import { Spot } from '../src/engine/types';

const mk = (name: string, lat: number, lon: number): Spot => ({ id: name, name, region: 'X', lat, lon, facing: 180 });
const long = mk('Long Beach', 40.583, -73.658), lido = mk('Lido Beach', 40.586, -73.617), pipe = mk('Pipeline', 21.665, -158.053);
const all = [long, lido, pipe];

test('nearest spot finds the closest beach and its distance', () => {
  const n = nearestSpot(all, 40.59, -73.62)!;
  assert.equal(n.spot.name, 'Lido Beach');
  assert.ok(n.km < 1.5);
});

test('far from every beach still returns the nearest one', () => {
  const n = nearestSpot(all, -33.9, 151.2)!; // Sydney: nothing within 3 degrees of latitude
  assert.ok(n && n.km > 5000);
});

test('no location yet invites a tap', () => {
  assert.equal(youLine(null, long, null, 'us'), 'Tap to show where you are');
});

test('standing on the chosen beach', () => {
  const me = { lat: 40.5832, lon: -73.6581, place: 'Long Beach, New York' };
  assert.equal(youLine(me, long, nearestSpot(all, me.lat, me.lon), 'us'), "You're at this beach");
});

test('standing on a different beach says which one and how far the chosen one is', () => {
  const me = { lat: 40.586, lon: -73.617, place: null };
  const line = youLine(me, pipe, nearestSpot(all, me.lat, me.lon), 'us');
  assert.match(line, /^You're at Lido Beach · [\d]+ mi from Pipeline$/);
});

test('away from the beach, with a town name', () => {
  const me = { lat: 40.7, lon: -74.0, place: 'New York, New York' };
  const line = youLine(me, pipe, nearestSpot(all, me.lat, me.lon), 'us');
  assert.match(line, /^You: New York, New York · [\d]+ mi away$/);
});

test('away from the beach, no town name falls back to the nearest beach, in metric if asked', () => {
  const me = { lat: 40.7, lon: -74.0, place: null };
  const line = youLine(me, pipe, nearestSpot(all, me.lat, me.lon), 'metric');
  assert.match(line, /^You: near (Long|Lido) Beach · [\d]+ km away$/);
});
