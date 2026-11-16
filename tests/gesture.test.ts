import test from 'node:test';
import assert from 'node:assert/strict';
import { gestureTransform, MapView, viewAfter, worldAt, zoomAbout } from '../src/map/gesture';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, a + ' vs ' + b);
const view: MapView = { cx: 0.28, cy: 0.37, z: 9 };
const identity = { tx: 0, ty: 0, s: 1 };

// the world point under f0 before the gesture must be under m after it
function checkFollowsFingers(f0: { x: number; y: number }, m: { x: number; y: number }, k: number) {
  const before = worldAt(view, f0);
  const xf = gestureTransform(identity, f0, m, k);
  const next = viewAfter(view, { x: xf.tx, y: xf.ty }, xf.s, 2, 11);
  const after = worldAt(next, m);
  close(after.wx, before.wx, 1e-9);
  close(after.wy, before.wy, 1e-9);
  return next;
}

test('a one-finger drag moves the map by exactly the drag', () => {
  const next = checkFollowsFingers({ x: 40, y: 10 }, { x: 140, y: -50 }, 1);
  assert.equal(next.z, view.z);
  assert.ok(next.cx < view.cx, 'dragging right moves the view west');
});

test('pinching out keeps the spot between your fingers in place', () => {
  const next = checkFollowsFingers({ x: 70, y: -40 }, { x: 70, y: -40 }, 2);
  close(next.z, view.z + 1, 1e-9);
});

test('pinching in, while the fingers also drift, still follows them', () => {
  checkFollowsFingers({ x: -90, y: 120 }, { x: -60, y: 100 }, 0.5);
});

test('zooming about a double-tapped point keeps that point under the finger', () => {
  const f = { x: -120, y: 80 };
  const xf = zoomAbout(f, 2);
  const before = worldAt(view, f);
  const next = viewAfter(view, { x: xf.tx, y: xf.ty }, xf.s, 2, 11);
  const after = worldAt(next, f);
  close(after.wx, before.wx);
  close(after.wy, before.wy);
});

test('zooming about the centre does not move the centre', () => {
  const xf = zoomAbout({ x: 0, y: 0 }, 0.5);
  const next = viewAfter(view, { x: xf.tx, y: xf.ty }, xf.s, 2, 11);
  close(next.cx, view.cx);
  close(next.cy, view.cy);
  close(next.z, view.z - 1);
});

test('zoom is limited, and the map wraps around the world instead of running off the edge', () => {
  const out = viewAfter({ cx: 0.99, cy: 0.5, z: 11 }, { x: -2000, y: 0 }, 4, 2, 11);
  assert.equal(out.z, 11);
  assert.ok(out.cx >= 0 && out.cx < 1);
  const poles = viewAfter({ cx: 0.5, cy: 0.04, z: 5 }, { x: 0, y: 5000 }, 1, 2, 11);
  assert.ok(poles.cy >= 0.03 && poles.cy <= 0.97);
});

test('two stretches of one gesture (a second finger arrives) stay continuous', () => {
  // first finger drags to m1; then a second finger lands and the picture continues from there
  const f0 = { x: 30, y: 30 }, m1 = { x: 90, y: 10 };
  const a = gestureTransform(identity, f0, m1, 1);
  const f1 = { x: 90, y: 10 }; // new baseline = where the fingers are now
  const b = gestureTransform(a, f1, m1, 1.0); // no further movement: nothing changes
  close(b.tx, a.tx); close(b.ty, a.ty); close(b.s, a.s);
  const c = gestureTransform(a, f1, m1, 1.5); // then they spread by 1.5x about that point
  const w1 = worldAt(viewAfter(view, { x: a.tx, y: a.ty }, a.s, 2, 11), m1);
  const w2 = worldAt(viewAfter(view, { x: c.tx, y: c.ty }, c.s, 2, 11), m1);
  close(w1.wx, w2.wx, 1e-9); close(w1.wy, w2.wy, 1e-9);
});
