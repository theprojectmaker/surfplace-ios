// Draws the map itself: turns the coastline index (coast.ts) into a grid of land / sand / shallow / sea
// cells for whatever area the screen is showing, as a few SVG paths.

import { Platform } from 'react-native';
import { buildCoast, countAbove, crossings } from './coast';

// ---------- web-mercator helpers (world coordinates run 0..1) ----------
export const lonToWx = (lon: number) => (lon + 180) / 360;
export const latToWy = (lat: number) => {
  const r = Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};
export const wxToLon = (wx: number) => ((((wx * 360 - 180) + 180) % 360) + 360) % 360 - 180;
export const wyToLat = (wy: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI;

const hash = (x: number, y: number) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const rect = (c: number, r: number, w = 1) => 'M' + c + ' ' + r + 'h' + w + 'v1h' + -w + 'z';

export const COLORS = {
  sea: '#1e9bd7', seaDark: '#1784c4', seaLight: '#7fd8f5', shallow: '#46c4e8', foam: '#ffffff', sand: '#f6e2a4',
  land: '#68c468', landDark: '#54b05c', landLight: '#80d476',
};

export type Raster = {
  cols: number; rows: number;
  /** 0 deep sea, 1 land, 2 sand, 3 shallow sea */
  kind: Uint8Array;
  paths: { land: string; landDark: string; landLight: string; sand: string; shallow: string; seaDark: string };
  shore: Int32Array;
  gx0: number; gy0: number;
};

// one cell = `cell` screen pixels; `cx`,`cy` is the world position at the middle of the cell grid
export function rasterize(cx: number, cy: number, zoom: number, cols: number, rows: number, cell: number): Raster {
  buildCoast();
  const S = 256 * Math.pow(2, zoom);
  const kind = new Uint8Array(cols * rows);
  const lonOf = new Float64Array(cols);
  for (let c = 0; c < cols; c++) lonOf[c] = wxToLon(cx + ((c + 0.5 - cols / 2) * cell) / S);

  for (let r = 0; r < rows; r++) {
    const wy = cy + ((r + 0.5 - rows / 2) * cell) / S;
    if (wy < 0 || wy > 1) continue; // beyond the poles: open sea
    const xs = crossings(wyToLat(wy));
    if (!xs.length) continue;
    for (let c = 0; c < cols; c++) if (countAbove(xs, lonOf[c]) & 1) kind[r * cols + c] = 1;
  }

  // coast pass: land touching sea becomes sand, sea touching land becomes shallows
  const out = new Uint8Array(kind);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c, me = kind[i];
      let other = false;
      if (c > 0 && kind[i - 1] !== me) other = true;
      else if (c < cols - 1 && kind[i + 1] !== me) other = true;
      else if (r > 0 && kind[i - cols] !== me) other = true;
      else if (r < rows - 1 && kind[i + cols] !== me) other = true;
      if (other) out[i] = me === 1 ? 2 : 3;
    }
  }

  const gx0 = Math.round((cx * S) / cell) - Math.floor(cols / 2), gy0 = Math.round((cy * S) / cell) - Math.floor(rows / 2);
  let land = '', landDark = '', landLight = '', sand = '', shallow = '', seaDark = '';
  const shore: number[] = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const k = out[r * cols + c];
      if (k === 1 || k === 2 || k === 3) {
        let e = c + 1;
        while (e < cols && out[r * cols + e] === k) e++;
        if (k === 1) land += rect(c, r, e - c); else if (k === 2) sand += rect(c, r, e - c); else shallow += rect(c, r, e - c);
        if (k === 3) for (let q = c; q < e; q++) shore.push(r * cols + q);
        c = e;
      } else c++;
    }
    for (let c2 = 0; c2 < cols; c2++) {
      const k = out[r * cols + c2];
      const gx = gx0 + c2, gy = gy0 + r;
      if (k === 1) {
        const h = hash(gx, gy);
        if (h < 0.12) landDark += rect(c2, r); else if (h > 0.92) landLight += rect(c2, r);
      } else if (k === 0 && ((gx + gy) & 1) && hash(gx >> 2, gy >> 2) < 0.2) seaDark += rect(c2, r);
    }
  }
  return { cols, rows, kind: out, paths: { land, landDark, landLight, sand, shallow, seaDark }, shore: Int32Array.from(shore), gx0, gy0 };
}

// the moving parts: rows of wave crests sliding sideways, and foam washing along the shore
export function waves(r: Raster, t: number): { white: string; light: string } {
  let white = '', light = '';
  const { cols, rows, kind } = r;
  for (let row = 0; row < rows; row++) {
    const band = Math.floor(row / 5), m = row % 5;
    if (m !== 0 && m !== 3) continue;
    const shift = (t * (1 + (band % 3))) >> 1;
    const first = (((-(band * 7 + shift)) % 13) + 13) % 13;
    for (let c = first; c < cols - 3; c += 13) {
      const i = row * cols + c;
      if (kind[i] || kind[i + 1] || kind[i + 2] || kind[i + 3]) continue; // only over deep water
      if (m === 0) { light += rect(c, row) + rect(c + 3, row); white += rect(c + 1, row, 2); } else light += rect(c + 1, row, 2);
    }
  }
  const shore = r.shore;
  for (let k = 0; k < shore.length; k++) {
    const i = shore[k], c = i % cols, row = (i / cols) | 0;
    if (((r.gx0 + c + r.gy0 + row + t) % 6 + 6) % 6 < 2) white += rect(c, row);
  }
  return { white, light };
}

export const MAP_IS_WEB = Platform.OS === 'web';
