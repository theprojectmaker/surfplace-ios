// The maths behind panning, pinching and zooming the map. Pure functions, so they are tested.
//
// While your fingers are down the whole map picture is moved and scaled (cheap and smooth);
// when they lift, the picture is redrawn at the new position and zoom. Coordinates here are in
// screen points measured from the centre of the map view.

export type Xf = { tx: number; ty: number; s: number }; // picture offset and scale
export type Pt = { x: number; y: number };
export type MapView = { cx: number; cy: number; z: number }; // cx, cy: world position (0..1) at the centre

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const wrap = (v: number) => ((v % 1) + 1) % 1;

// The picture transform that keeps the spot you first touched (f0) under your fingers (now at m),
// when the fingers have spread or closed by a factor k. With one finger (k = 1) it is a plain drag.
// `base` is whatever offset/scale the picture already had when this stretch of the gesture began.
export function gestureTransform(base: Xf, f0: Pt, m: Pt, k: number): Xf {
  return { s: base.s * k, tx: k * base.tx + m.x - k * f0.x, ty: k * base.ty + m.y - k * f0.y };
}

// Zooming by factor s about a point f (a double tap, for example) while everything else stays put.
export function zoomAbout(f: Pt, s: number): Xf {
  return { s, tx: f.x * (1 - s), ty: f.y * (1 - s) };
}

// The view you end up with after the picture has been moved by `t` and scaled by `s`.
export function viewAfter(v: MapView, t: Pt, s: number, minZ: number, maxZ: number): MapView {
  const z = clamp(v.z + Math.log2(s), minZ, maxZ);
  const sNew = 256 * Math.pow(2, z);
  return { cx: wrap(v.cx - t.x / sNew), cy: clamp(v.cy - t.y / sNew, 0.03, 0.97), z };
}

// the world position under a screen point (relative to the centre) in a given view
export function worldAt(v: MapView, p: Pt): { wx: number; wy: number } {
  const S = 256 * Math.pow(2, v.z);
  return { wx: v.cx + p.x / S, wy: v.cy + p.y / S };
}
