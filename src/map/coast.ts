// The world coastline as an index for "is this point land?". Pure logic (no React Native),
// so it is unit tested against places whose answer is known.
//
// The coastline (Natural Earth, public domain) is a set of closed rings. Land that crosses the
// date line (far-east Russia, Wrangel Island, Fiji) is stored as a ring that jumps from +180 to
// -180, so every ring is first "unwrapped" into one continuous shape, then drawn again one world
// to the east and west. Segments are bucketed by latitude; a row's land is found by counting how
// many coast edges lie east of each point (odd = land).

export type Topo = {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: { land: { geometries: { type: string; arcs: any }[] } };
};

const B = 0.05; // latitude bucket height in degrees
let index: Map<number, Float32Array> | null = null;

function decodeArcs(t: Topo): Float64Array[] {
  const [sx, sy] = t.transform.scale, [tx, ty] = t.transform.translate;
  return t.arcs.map((arc) => {
    const out = new Float64Array(arc.length * 2);
    let x = 0, y = 0;
    for (let i = 0; i < arc.length; i++) {
      x += arc[i][0]; y += arc[i][1];
      out[2 * i] = x * sx + tx; out[2 * i + 1] = y * sy + ty;
    }
    return out;
  });
}

// one ring as continuous longitudes (it may run past +-180)
export function unwrap(p: number[]): Float64Array {
  const out: number[] = [];
  let shift = 0, prev = 0;
  for (let i = 0; i < p.length; i += 2) {
    let x = p[i] + shift;
    if (i && x - prev > 180) { shift -= 360; x -= 360; } else if (i && prev - x > 180) { shift += 360; x += 360; }
    out.push(x, p[i + 1]);
    prev = x;
  }
  if (shift !== 0) {
    // the ring goes all the way round the pole (Antarctica): close it past the pole
    let mean = 0;
    for (let i = 1; i < out.length; i += 2) mean += out[i];
    const edge = mean / (out.length / 2) > 0 ? 95 : -95;
    out.push(prev, edge, out[0], edge);
  }
  return Float64Array.from(out);
}

function ringsOf(t: Topo): Float64Array[] {
  const arcs = decodeArcs(t);
  const rings: Float64Array[] = [];
  for (const g of t.objects.land.geometries) {
    const polys: number[][][] = g.type === 'Polygon' ? [g.arcs] : g.arcs;
    for (const poly of polys) {
      for (const ring of poly) {
        const pts: number[] = [];
        for (const ai of ring) {
          const a = arcs[ai < 0 ? ~ai : ai], n = a.length / 2;
          for (let j = 0; j < n; j++) {
            if (pts.length && j === 0) continue; // an arc starts where the last one ended
            const q = ai < 0 ? n - 1 - j : j;
            pts.push(a[2 * q], a[2 * q + 1]);
          }
        }
        rings.push(unwrap(pts));
      }
    }
  }
  return rings;
}

export function buildCoast(topo?: Topo): void {
  if (index) return;
  const t = topo || (require('../data/land.json') as Topo);
  const rings = ringsOf(t);
  const bmax = Math.floor(86 / B), bmin = -bmax;
  const each = (fn: (x1: number, y1: number, x2: number, y2: number) => void) => {
    for (const r of rings) {
      let minx = Infinity, maxx = -Infinity;
      for (let i = 0; i < r.length; i += 2) { if (r[i] < minx) minx = r[i]; if (r[i] > maxx) maxx = r[i]; }
      for (const shift of [0, 360, -360]) {
        if (maxx + shift < -180.5 || minx + shift > 180.5) continue; // this copy of the ring is off the map
        const n = r.length / 2;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n; // rings are closed
          fn(r[2 * i] + shift, r[2 * i + 1], r[2 * j] + shift, r[2 * j + 1]);
        }
      }
    }
  };
  const counts = new Map<number, number>();
  each((_x1, y1, _x2, y2) => {
    if (y1 === y2) return;
    const lo = Math.max(bmin, Math.floor(Math.min(y1, y2) / B)), hi = Math.min(bmax, Math.floor(Math.max(y1, y2) / B));
    for (let b = lo; b <= hi; b++) counts.set(b, (counts.get(b) || 0) + 1);
  });
  const store = new Map<number, Float32Array>();
  const fill = new Map<number, number>();
  counts.forEach((n, b) => { store.set(b, new Float32Array(n * 4)); fill.set(b, 0); });
  each((x1, y1, x2, y2) => {
    if (y1 === y2) return;
    const lo = Math.max(bmin, Math.floor(Math.min(y1, y2) / B)), hi = Math.min(bmax, Math.floor(Math.max(y1, y2) / B));
    for (let b = lo; b <= hi; b++) {
      const arr = store.get(b) as Float32Array, k = fill.get(b) as number;
      arr[k] = x1; arr[k + 1] = y1; arr[k + 2] = x2; arr[k + 3] = y2;
      fill.set(b, k + 4);
    }
  });
  index = store;
}

// longitudes where the line at this latitude crosses the coast, sorted
export function crossings(lat: number): number[] {
  const arr = index && index.get(Math.floor(lat / B));
  const xs: number[] = [];
  if (!arr) return xs;
  for (let i = 0; i < arr.length; i += 4) {
    const y1 = arr[i + 1], y2 = arr[i + 3];
    if ((y1 > lat) !== (y2 > lat)) xs.push(arr[i] + ((lat - y1) / (y2 - y1)) * (arr[i + 2] - arr[i]));
  }
  return xs.sort((a, b) => a - b);
}

// how many crossings are east of lon
export function countAbove(xs: number[], lon: number): number {
  let lo = 0, hi = xs.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] <= lon) lo = m + 1; else hi = m; }
  return xs.length - lo;
}

export function isLand(lat: number, lon: number): boolean {
  return (countAbove(crossings(lat), lon) & 1) === 1;
}
