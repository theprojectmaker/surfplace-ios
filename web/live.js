// Real measurements for a spot, fetched straight from NOAA:
//   - NDBC buoys: measured wave height / period / direction, wind, water temperature
//   - CO-OPS tide stations: official high / low tide times
// NOAA's buoy file cannot be read directly by a web page, so requests go through a
// tiny relay: the iPhone app itself, or the local server (serve.js) on a computer.
const Live = (() => {
  const native = () => !!window.ReactNativeWebView;
  const pending = {};
  let seq = 0;

  // the iPhone app answers through this
  window.__spResolve = (id, ok, payload) => {
    const p = pending[id];
    if (!p) return;
    delete pending[id];
    clearTimeout(p.timer);
    if (ok) p.resolve(payload); else p.reject(new Error(String(payload || 'failed')));
  };
  function ask(msg, ms) {
    return new Promise((resolve, reject) => {
      const id = 'r' + (++seq);
      const timer = setTimeout(() => { delete pending[id]; reject(new Error('timeout')); }, ms || 20000);
      pending[id] = { resolve, reject, timer };
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ id }, msg)));
    });
  }

  function fetchText(url) {
    if (native()) return ask({ type: 'fetch', url });
    return fetch('/api/proxy?url=' + encodeURIComponent(url)).then((r) => {
      if (!r.ok) throw new Error('relay ' + r.status);
      return r.text();
    });
  }

  const km = (la1, lo1, la2, lo2) => {
    const r = Math.PI / 180;
    const a = Math.sin(((la2 - la1) * r) / 2) ** 2 +
      Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  };

  // ---------- buoys ----------
  let obs = { at: 0, rows: null };
  async function buoyRows() {
    if (obs.rows && Date.now() - obs.at < 10 * 60 * 1000) return obs.rows;
    const text = await fetchText('https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt');
    const rows = [];
    text.split('\n').forEach((line) => {
      if (!line || line[0] === '#') return;
      const c = line.trim().split(/\s+/);
      if (c.length < 19) return;
      const n = (i) => (c[i] === 'MM' ? null : Number(c[i]));
      const time = Date.UTC(+c[3], +c[4] - 1, +c[5], +c[6], +c[7]);
      if (!isFinite(time) || Date.now() - time > 3 * 3600 * 1000) return; // stale reading
      rows.push({
        id: c[0], lat: +c[1], lon: +c[2], time,
        wdir: n(8), wspd: n(9), gst: n(10), wvht: n(11), dpd: n(12), apd: n(13), mwd: n(14),
        atmp: n(17), wtmp: n(18),
      });
    });
    if (!rows.length) throw new Error('no buoy rows');
    obs = { at: Date.now(), rows };
    return rows;
  }
  function nearest(rows, lat, lon, has, maxKm) {
    let best = null;
    rows.forEach((r) => {
      if (!has(r)) return;
      const d = km(lat, lon, r.lat, r.lon);
      if (d <= maxKm && (!best || d < best.km)) best = Object.assign({ km: Math.round(d) }, r);
    });
    return best;
  }

  // ---------- tides ----------
  const tideCache = {};
  async function tidesFor(lat, lon) {
    if (typeof TIDE_STATIONS === 'undefined') return null;
    let best = null;
    TIDE_STATIONS.forEach((s) => {
      const d = km(lat, lon, s[2], s[3]);
      if (d <= 60 && (!best || d < best.km)) best = { id: s[0], name: s[1], km: Math.round(d) };
    });
    if (!best) return null;
    const hit = tideCache[best.id];
    if (hit && Date.now() - hit.at < 3 * 3600 * 1000) return hit.data;
    const y = new Date(Date.now() - 36 * 3600 * 1000);
    const begin = y.getUTCFullYear() + String(y.getUTCMonth() + 1).padStart(2, '0') + String(y.getUTCDate()).padStart(2, '0');
    const json = JSON.parse(await fetchText('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=surfplace' +
      '&begin_date=' + begin + '&range=240&datum=MLLW&station=' + best.id +
      '&time_zone=lst_ldt&units=metric&interval=hilo&format=json'));
    if (!json.predictions || !json.predictions.length) return null;
    const data = { station: best, hilo: json.predictions.map((p) => ({ t: p.t, v: +p.v, type: p.type })) };
    tideCache[best.id] = { at: Date.now(), data };
    return data;
  }

  // Everything measured near a spot. Returns null if the relay cannot be reached at all.
  async function get(lat, lon) {
    const out = { buoy: null, wind: null, water: null, tide: null };
    let reached = false;
    try {
      const rows = await buoyRows();
      reached = true;
      out.buoy = nearest(rows, lat, lon, (r) => r.wvht !== null && (r.dpd !== null || r.apd !== null), 300);
      out.wind = nearest(rows, lat, lon, (r) => r.wspd !== null && r.wdir !== null, 50);
      out.water = nearest(rows, lat, lon, (r) => r.wtmp !== null, 120);
    } catch (e) { /* buoys unavailable */ }
    try {
      out.tide = await tidesFor(lat, lon);
      if (out.tide) reached = true;
    } catch (e) { /* tides unavailable */ }
    return reached ? out : null;
  }

  // Where the phone is. In the iPhone app this uses the phone's own location service.
  function locate() {
    if (native()) return ask({ type: 'locate' }, 25000).then((s) => JSON.parse(s));
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => reject(new Error('denied')), { timeout: 10000, maximumAge: 600000 });
    });
  }

  return { get, locate };
})();
