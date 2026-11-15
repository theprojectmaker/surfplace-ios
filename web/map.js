// Live pixel map. Real coastlines are rasterised onto a chunky grid, every cell is
// sea or land, and the sea is repainted with animated pixel waves.
const SurfMap = (() => {
  const CELLS = 64; // pixel cells per 256px map tile

  // palette (r,g,b)
  const C = {
    sea: [30, 155, 215],
    seaDark: [23, 132, 196],
    seaLight: [127, 216, 245],
    shallow: [70, 196, 232],
    foam: [255, 255, 255],
    sand: [246, 226, 164],
    land: [104, 196, 104],
    landDark: [84, 176, 92],
    landLight: [128, 212, 118],
  };

  const live = new Map(); // key -> tile record
  let map, tick = 0, timer = null;
  const scratch = document.createElement('canvas');
  scratch.width = scratch.height = CELLS;
  const sctx = scratch.getContext('2d', { willReadFrequently: true });

  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function put(d, i, c) {
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }

  // ---- coastline data (Natural Earth, public domain), projected once to web-mercator 0..1 ----
  let rings = null;
  const landReady = (window.LAND_TOPO ? Promise.resolve(window.LAND_TOPO) : fetch('land-10m.json').then((r) => r.json())).then((topo) => {
    const sx = topo.transform.scale[0], sy = topo.transform.scale[1];
    const tx = topo.transform.translate[0], ty = topo.transform.translate[1];
    const arcs = topo.arcs.map((arc) => {
      const out = new Float32Array(arc.length * 2);
      let x = 0, y = 0;
      for (let i = 0; i < arc.length; i++) {
        x += arc[i][0]; y += arc[i][1];
        const lon = x * sx + tx;
        const lat = Math.max(-85.05, Math.min(85.05, y * sy + ty)) * Math.PI / 180;
        out[i * 2] = (lon + 180) / 360;
        out[i * 2 + 1] = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2;
      }
      return out;
    });
    const list = [];
    topo.objects.land.geometries.forEach((g) => {
      const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
      polys.forEach((poly) => poly.forEach((ring) => {
        let len = 0;
        ring.forEach((ai) => { len += arcs[ai < 0 ? ~ai : ai].length / 2; });
        // Land that crosses the date line (far-east Russia) jumps from one edge of the map to
        // the other. Unwrap it so the ring stays in one piece; it is then drawn once per
        // world copy. Without this a false strip of sea is cut across the whole Arctic.
        const pts = new Float32Array(len * 2 + 4);
        let k = 0, x0 = 9, y0 = 9, x1 = -9, y1 = -9, shift = 0, prev = null;
        ring.forEach((ai) => {
          const arc = arcs[ai < 0 ? ~ai : ai], m = arc.length / 2;
          for (let j = 0; j < m; j++) {
            const q = ai < 0 ? m - 1 - j : j;
            let px = arc[q * 2] + shift;
            const py = arc[q * 2 + 1];
            if (prev !== null) {
              if (px - prev > 0.5) { shift -= 1; px -= 1; } else if (prev - px > 0.5) { shift += 1; px += 1; }
            }
            prev = px;
            pts[k++] = px; pts[k++] = py;
            if (px < x0) x0 = px; if (px > x1) x1 = px;
            if (py < y0) y0 = py; if (py > y1) y1 = py;
          }
        });
        if (shift !== 0) {
          // a ring that goes all the way round the globe (Antarctica): close it past the pole
          const edge = (y0 + y1) / 2 > 0.5 ? 1.5 : -0.5;
          pts[k++] = prev; pts[k++] = edge;
          pts[k++] = pts[0]; pts[k++] = edge;
          if (edge > y1) y1 = edge; if (edge < y0) y0 = edge;
        }
        list.push({ pts: pts.subarray(0, k), x0, y0, x1, y1 });
      }));
    });
    rings = list;
  }).catch(() => { rings = []; });

  // Rasterise the land that falls inside one tile onto the small scratch canvas.
  function drawLand(coords) {
    const n = CELLS, scale = Math.pow(2, coords.z);
    const max = scale, tx = ((coords.x % max) + max) % max, ty = coords.y;
    const lo = -6, hi = n + 6;
    const bx0 = tx / scale, bx1 = (tx + 1) / scale, by0 = ty / scale, by1 = (ty + 1) / scale;
    sctx.clearRect(0, 0, n, n);
    sctx.beginPath();
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      if (ring.y1 < by0 || ring.y0 > by1) continue;
      const p = ring.pts;
      for (let o = -1; o <= 1; o++) { // each copy of the world the ring could show up in
        if (ring.x1 + o < bx0 || ring.x0 + o > bx1) continue;
        let lastCode = -1, pendX = 0, pendY = 0, pending = false, started = false;
        for (let i = 0; i < p.length; i += 2) {
          const x = ((p[i] + o) * scale - tx) * n, y = (p[i + 1] * scale - ty) * n;
          const code = (x < lo ? 1 : x > hi ? 2 : 0) | (y < lo ? 4 : y > hi ? 8 : 0);
          // a run of points off the same side of the tile collapses to its last point
          if (code !== 0 && code === lastCode) { pendX = x; pendY = y; pending = true; continue; }
          if (pending) { sctx.lineTo(pendX, pendY); pending = false; }
          if (started) sctx.lineTo(x, y); else { sctx.moveTo(x, y); started = true; }
          lastCode = code;
        }
        if (pending) sctx.lineTo(pendX, pendY);
        if (started) sctx.closePath();
      }
    }
    sctx.fillStyle = '#000';
    sctx.fill('evenodd');
    return sctx.getImageData(0, 0, n, n).data;
  }

  function buildTile(rec) {
    const n = CELLS;
    const src = drawLand(rec.coords);
    const kind = new Uint8Array(n * n); // 0 sea, 1 land, 2 sand, 3 shallow sea
    for (let i = 0; i < n * n; i++) kind[i] = src[i * 4 + 3] > 110 ? 1 : 0;
    // coast pass: land touching sea becomes sand, sea touching land becomes shallows
    const out = new Uint8Array(kind);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const me = kind[i];
        let other = false;
        if (x > 0 && kind[i - 1] !== me) other = true;
        else if (x < n - 1 && kind[i + 1] !== me) other = true;
        else if (y > 0 && kind[i - n] !== me) other = true;
        else if (y < n - 1 && kind[i + n] !== me) other = true;
        if (other) out[i] = me === 1 ? 2 : 3;
      }
    }
    rec.kind = out;
    rec.image = rec.ctx.createImageData(n, n);
    const d = rec.image.data;
    const gx0 = rec.coords.x * n, gy0 = rec.coords.y * n;
    const water = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const k = out[i];
        if (k === 1) {
          const h = hash(gx0 + x, gy0 + y);
          put(d, i * 4, h < 0.14 ? C.landDark : h > 0.9 ? C.landLight : C.land);
        } else if (k === 2) {
          put(d, i * 4, C.sand);
        } else {
          water.push(i);
        }
      }
    }
    rec.water = water;
    rec.ready = true;
    paintWater(rec);
  }

  function paintWater(rec) {
    const n = CELLS, d = rec.image.data, kind = rec.kind, water = rec.water;
    const gx0 = rec.coords.x * n, gy0 = rec.coords.y * n;
    const t = tick;
    for (let w = 0; w < water.length; w++) {
      const i = water[w];
      const gx = gx0 + (i % n), gy = gy0 + ((i / n) | 0);
      // rows of short crests that slide sideways, each row at its own pace
      const row = gy % 5;
      const band = (gy / 5) | 0;
      const speed = 1 + (band % 3);
      const phase = (gx + band * 7 + ((t * speed) >> 1)) % 13;
      let c;
      if (kind[i] === 3) {
        // shoreline: foam that washes in and out
        c = ((gx + gy + t) % 6 < 2) ? C.foam : C.shallow;
      } else if (row === 0 && phase < 4) {
        c = phase === 0 || phase === 3 ? C.seaLight : C.foam;
      } else if (row === 1 && phase > 0 && phase < 5) {
        c = C.seaLight;
      } else if (row === 3 && (phase + 6) % 13 < 3) {
        c = C.seaDark;
      } else {
        c = ((gx + gy) & 1) && hash(gx >> 2, gy >> 2) < 0.25 ? C.seaDark : C.sea;
      }
      put(d, i * 4, c);
    }
    rec.ctx.putImageData(rec.image, 0, 0);
  }

  function frame() {
    tick++;
    live.forEach((rec) => { if (rec.ready && rec.water.length) paintWater(rec); });
  }

  const PixelLayer = L.GridLayer.extend({
    createTile(coords, done) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = CELLS;
      canvas.className = 'px-tile';
      const rec = { coords, canvas, ctx: canvas.getContext('2d'), ready: false, water: [] };
      const key = coords.z + '/' + coords.x + '/' + coords.y;
      rec.key = key;
      live.set(key, rec);
      landReady.then(() => {
        if (!live.has(key)) return; // tile was dropped while the coastline loaded
        buildTile(rec);
        done(null, canvas);
      });
      return canvas;
    },
  });

  // Thousands of beaches would bury the map, so only the flags that fit are drawn:
  // one per patch of screen, famous spots first. Zooming in reveals the rest.
  let flags = null, customMarker = null, selected = null, onPick = () => {};

  function flagIcon(cls) {
    return L.divIcon({ className: '', html: '<div class="flag ' + cls + '"></div>', iconSize: [20, 24], iconAnchor: [4, 24] });
  }

  function refreshFlags() {
    if (!flags) return;
    flags.clearLayers();
    const z = map.getZoom(), labels = z >= 10;
    const cw = labels ? 120 : 44, ch = labels ? 46 : 44;
    const bounds = map.getBounds().pad(0.05), taken = new Set();
    const place = (bch, on) => {
      const p = map.latLngToContainerPoint([bch.lat, bch.lon]);
      const key = Math.floor(p.x / cw) + ',' + Math.floor(p.y / ch);
      if (!on && taken.has(key)) return;
      taken.add(key);
      const m = L.marker([bch.lat, bch.lon], { icon: flagIcon(on ? 'on' : ''), title: bch.name, zIndexOffset: on ? 1000 : 0 });
      if (labels || on) m.bindTooltip(bch.name, { permanent: true, direction: 'right', offset: [12, -16], className: on ? 'tip-on' : '' });
      m.on('click', () => onPick(bch));
      flags.addLayer(m);
    };
    if (selected && !selected.custom && bounds.contains([selected.lat, selected.lon])) place(selected, true);
    for (let i = 0; i < BEACHES.length; i++) { // BEACHES is ordered famous-first
      const bch = BEACHES[i];
      if (selected && bch.id === selected.id) continue;
      if (z < 6 && !bch.top) continue;
      if (bounds.contains([bch.lat, bch.lon])) place(bch, false);
    }
  }

  function nearestBeach(lat, lon) {
    let best = null, bd = Infinity;
    const c = Math.cos(lat * Math.PI / 180);
    for (let i = 0; i < BEACHES.length; i++) {
      const d = (BEACHES[i].lat - lat) ** 2 + ((BEACHES[i].lon - lon) * c) ** 2;
      if (d < bd) { bd = d; best = BEACHES[i]; }
    }
    return { beach: best, km: Math.sqrt(bd) * 111.19 };
  }

  function init(el, pick) {
    onPick = pick;
    map = L.map(el, { minZoom: 2, maxZoom: 13, worldCopyJump: true, zoomSnap: 1, attributionControl: true });
    map.attributionControl.setPrefix(false);
    const layer = new PixelLayer({
      tileSize: 256, keepBuffer: 1, updateWhenZooming: false,
      attribution: 'Coast: Natural Earth · Beaches: © OpenStreetMap',
    });
    layer.on('tileunload', (e) => {
      live.forEach((rec, key) => { if (rec.canvas === e.tile) live.delete(key); });
    });
    layer.addTo(map);
    flags = L.layerGroup().addTo(map);
    map.on('moveend zoomend', refreshFlags);

    // tapping open water or coast: offer the nearest beach, or that exact spot
    map.on('click', (e) => {
      const ll = e.latlng.wrap();
      const near = nearestBeach(ll.lat, ll.lng);
      const box = document.createElement('div');
      box.className = 'tap-menu';
      if (near.beach && near.km < 60) {
        const b1 = document.createElement('button');
        b1.textContent = near.beach.name;
        b1.addEventListener('click', () => { map.closePopup(); onPick(near.beach); });
        box.appendChild(b1);
      }
      const b2 = document.createElement('button');
      b2.className = 'alt';
      b2.textContent = 'This exact spot';
      b2.addEventListener('click', () => {
        map.closePopup();
        onPick({
          id: 'custom', custom: true, name: 'Custom spot',
          region: Math.abs(ll.lat).toFixed(2) + '°' + (ll.lat >= 0 ? 'N' : 'S') + ', ' +
            Math.abs(ll.lng).toFixed(2) + '°' + (ll.lng >= 0 ? 'E' : 'W'),
          lat: +ll.lat.toFixed(3), lon: +ll.lng.toFixed(3), facing: null,
        });
      });
      box.appendChild(b2);
      L.popup({ closeButton: false, className: 'tap-pop', offset: [0, -4] }).setLatLng(e.latlng).setContent(box).openOn(map);
    });

    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) timer = setInterval(frame, 220);
    return map;
  }

  function select(spot, fly) {
    if (customMarker) { customMarker.remove(); customMarker = null; }
    selected = spot;
    if (spot.custom) {
      customMarker = L.marker([spot.lat, spot.lon], { icon: flagIcon('on custom'), interactive: false }).addTo(map);
    }
    if (fly) map.setView([spot.lat, spot.lon], Math.max(map.getZoom() || 0, 11), { animate: false });
    refreshFlags();
  }

  return { init, select, view: (lat, lon, z) => map && map.setView([lat, lon], z, { animate: false }) };
})();
