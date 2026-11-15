// Forecast engine: pulls the marine + weather models for a spot and turns them
// into surf height, a 0-100 surf score, and the best time windows to paddle out.
const Forecast = (() => {
  const MARINE = 'https://marine-api.open-meteo.com/v1/marine';
  const WEATHER = 'https://api.open-meteo.com/v1/forecast';
  const M2FT = 3.28084;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Forecast service answered ' + r.status);
    return r.json();
  }

  async function load(spot) {
    const q = 'latitude=' + spot.lat + '&longitude=' + spot.lon + '&timezone=auto&forecast_days=7';
    // real measurements (buoys + tide stations) come from the local SurfPlace server
    const liveP = Live.get(spot.lat, spot.lon).catch(() => null);
    // independent wave models, used to see how much the forecasts agree
    const modelsP = getJSON(MARINE + '?' + q + '&cell_selection=sea&hourly=wave_height' +
      '&models=ecmwf_wam025,ncep_gfswave025,meteofrance_wave').catch(() => null);
    const [m, w] = await Promise.all([
      getJSON(MARINE + '?' + q + '&cell_selection=sea&hourly=wave_height,wave_direction,wave_period,' +
        'swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,wind_wave_direction,' +
        'wind_wave_period,sea_surface_temperature,sea_level_height_msl'),
      getJSON(WEATHER + '?' + q + '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,' +
        'weather_code&daily=sunrise,sunset'),
    ]);
    const mh = m.hourly, wh = w.hourly;
    const n = Math.min(mh.time.length, wh.time.length);
    const sun = (w.daily.sunrise || []).map((s, d) => ({
      rise: hourOf(s), set: hourOf(w.daily.sunset[d]),
    }));
    const hours = [];
    let any = false;
    for (let i = 0; i < n; i++) {
      const day = (i / 24) | 0, hour = i % 24;
      const s = sun[day] || { rise: 6, set: 18 };
      const h = {
        i, day, hour, time: mh.time[i],
        H: num(mh.wave_height[i]), T: num(mh.wave_period[i]), D: num(mh.wave_direction[i]),
        swH: num(mh.swell_wave_height[i]), swT: num(mh.swell_wave_period[i]), swD: num(mh.swell_wave_direction[i]),
        wwH: num(mh.wind_wave_height[i]), wwT: num(mh.wind_wave_period[i]), wwD: num(mh.wind_wave_direction[i]),
        sst: num(mh.sea_surface_temperature[i]), tide: num(mh.sea_level_height_msl[i]),
        wind: num(wh.wind_speed_10m[i]) || 0, windDir: num(wh.wind_direction_10m[i]) || 0,
        gust: num(wh.wind_gusts_10m[i]) || 0, air: num(wh.temperature_2m[i]), code: wh.weather_code[i],
        light: hour + 0.5 >= s.rise - 0.5 && hour + 0.5 <= s.set + 0.3,
        dusk: Math.abs(hour + 0.5 - s.rise) < 0.8 || Math.abs(hour + 0.5 - s.set) < 0.8,
      };
      if (h.H !== null) any = true;
      hours.push(h);
    }
    if (!any) throw new Error('NO_OCEAN');
    // "now" in the beach's own time zone
    const local = new Date(Date.now() + (m.utc_offset_seconds || 0) * 1000);
    const stamp = local.toISOString().slice(0, 13) + ':00';
    let now = mh.time.indexOf(stamp);
    if (now < 0) now = 0;
    const days = [];
    for (let d = 0; d * 24 < n; d++) days.push({ d, date: mh.time[d * 24].slice(0, 10), sun: sun[d] });
    const data = {
      hours, days, now, tz: m.timezone_abbreviation || '',
      nowMin: naiveMin(local.toISOString().slice(0, 16)),
      live: null, cal: null, hilo: null, tideName: '', modelCount: 1,
    };

    // 1. how closely do the separate wave models agree, hour by hour?
    const mm = await modelsP;
    if (mm && mm.hourly) {
      const used = Object.keys(mm.hourly).filter((k) => {
        if (k.indexOf('wave_height_') !== 0) return false;
        const arr = mm.hourly[k];
        let same = true, a = 0, b = 0;
        for (let i = 0; i < Math.min(n, 48); i++) {
          const v = num(arr[i]);
          if (v !== null && hours[i].H !== null) { a += hours[i].H; b += v; }
          if (v !== hours[i].H) same = false;
        }
        // skip the model already used as the main forecast, and any model whose grid cell
        // here is land or badly sheltered (it reads zero or wildly different)
        return !same && b > 0 && a / b < 2.5 && a / b > 0.4;
      });
      data.modelCount = 1 + used.length;
      // Each model samples a slightly different patch of sea near the coast, which gives a
      // constant offset. Level that out over the first 2 days so the spread measures what
      // matters: whether the models agree on when the swell builds and drops.
      const scale = {};
      used.forEach((k) => {
        let a = 0, b = 0;
        for (let i = 0; i < Math.min(n, 48); i++) {
          const v = num(mm.hourly[k][i]);
          if (v !== null && hours[i].H !== null) { a += hours[i].H; b += v; }
        }
        scale[k] = b > 0 ? a / b : 1;
      });
      for (let i = 0; i < n; i++) {
        const ok = [hours[i].H].concat(used.map((k) => {
          const v = num(mm.hourly[k][i]);
          return v === null ? null : v * scale[k];
        })).filter((v) => v !== null);
        hours[i].spread = ok.length >= 2
          ? (Math.max.apply(null, ok) - Math.min.apply(null, ok)) / Math.max(ok.reduce((a, b) => a + b, 0) / ok.length, 0.4)
          : null;
      }
    }

    // 2. real measurements
    const lv = await liveP;
    if (lv && !lv.error) {
      data.live = lv;
      if (lv.tide && lv.tide.hilo.length > 1) {
        data.hilo = lv.tide.hilo.map((p) => ({ t: naiveMin(p.t), v: p.v, type: p.type }));
        data.tideName = lv.tide.station.name;
        hours.forEach((h) => { h.tide = tideAt(data.hilo, naiveMin(h.time)); });
      }
      // 3. calibration: compare what the buoy measured with what the model said for
      //    that same place and hour, then nudge the forecast by the difference.
      const b = lv.buoy;
      if (b && Date.now() - b.time < 2.5 * 3600 * 1000) {
        try {
          const bm = await getJSON(MARINE + '?latitude=' + b.lat + '&longitude=' + b.lon +
            '&cell_selection=sea&hourly=wave_height&timezone=GMT&past_days=1&forecast_days=2');
          const stamp = new Date(Math.round(b.time / 3600000) * 3600000).toISOString().slice(0, 13) + ':00';
          const k = bm.hourly.time.indexOf(stamp);
          const mv = k >= 0 ? num(bm.hourly.wave_height[k]) : null;
          if (mv !== null && mv >= 0.2 && b.wvht >= 0.1) {
            const raw = b.wvht / mv, ratio = clamp(raw, 0.6, 1.6);
            data.cal = { ratio, raw, model: mv, obs: b.wvht };
            hours.forEach((h) => {
              // the correction fades out: a buoy reading says little about 3 days from now
              const f = 1 + (ratio - 1) * Math.exp(-Math.max(0, h.i - now) / 18);
              if (h.H !== null) h.H *= f;
              if (h.swH !== null) h.swH *= f;
              if (h.wwH !== null) h.wwH *= f;
            });
          }
        } catch (e) { /* calibration is a bonus, the forecast still stands */ }
      }
    }
    return data;
  }

  // minutes for a "YYYY-MM-DD hh:mm" local clock time (no time zone maths needed)
  function naiveMin(s) {
    return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16)) / 60000;
  }
  function clock(min) {
    const day = ((min % 1440) + 1440) % 1440, h = Math.floor(day / 60), mi = Math.round(day % 60);
    return (h % 12 === 0 ? 12 : h % 12) + ':' + String(mi).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
  }
  // tide height between a high and a low follows a cosine curve
  function tideAt(pts, t) {
    for (let j = 0; j < pts.length - 1; j++) {
      if (pts[j].t <= t && t < pts[j + 1].t) {
        const k = (t - pts[j].t) / (pts[j + 1].t - pts[j].t);
        return pts[j].v + (pts[j + 1].v - pts[j].v) * (1 - Math.cos(Math.PI * k)) / 2;
      }
    }
    return null;
  }

  // 3 = high, 2 = medium, 1 = low. Based on model agreement, capped for far-off days.
  function confidence(data, d) {
    let sum = 0, cnt = 0;
    for (let i = d * 24; i < d * 24 + 24 && i < data.hours.length; i++) {
      const h = data.hours[i];
      if (h.light && h.spread !== null && h.spread !== undefined) { sum += h.spread; cnt++; }
    }
    const spread = cnt ? sum / cnt : null;
    let level = spread === null ? (d < 3 ? 2 : 1) : spread < 0.18 ? 3 : spread < 0.35 ? 2 : 1;
    if (d >= 5) level = Math.min(level, 2);
    return { level, spread };
  }

  function hourOf(iso) {
    if (!iso) return 12;
    return +iso.slice(11, 13) + +iso.slice(14, 16) / 60;
  }

  // How much of a swell reaches a beach, given where it comes from.
  function dirFactor(from, facing) {
    if (facing === null || from === null) return 0.8;
    const d = angDiff(from, facing);
    if (d <= 35) return 1;
    if (d <= 90) return lerp(1, 0.35, (d - 35) / 55);
    if (d <= 150) return lerp(0.35, 0.05, (d - 90) / 60);
    return 0.05;
  }

  // Longer-period swell shoals up and breaks bigger than its open-ocean height.
  const shoal = (t) => clamp(0.55 + ((t || 6) - 5) * 0.085, 0.5, 1.75);

  // Estimated breaking wave face, in meters.
  function face(h, facing) {
    if (h.swH === null && h.wwH === null) {
      if (h.H === null) return null;
      return h.H * shoal(h.T) * dirFactor(h.D, facing);
    }
    const sw = (h.swH || 0) * shoal(h.swT) * dirFactor(h.swD, facing);
    const ww = (h.wwH || 0) * shoal(h.wwT) * 0.8 * dirFactor(h.wwD, facing);
    return Math.sqrt(sw * sw + ww * ww);
  }

  function windInfo(h, facing) {
    const mph = h.wind * 0.621371;
    if (mph < 5) return { type: 'glassy', q: 1, mph };
    if (facing === null) {
      const q = mph < 8 ? 0.8 : mph < 12 ? 0.6 : mph < 18 ? 0.4 : mph < 25 ? 0.25 : 0.12;
      return { type: mph < 12 ? 'light' : mph < 20 ? 'breezy' : 'strong', q, mph };
    }
    const off = angDiff(h.windDir, facing); // 180 = blowing straight off the land
    if (off >= 125) {
      return { type: 'offshore', q: mph <= 15 ? 1 : mph <= 25 ? 0.72 : 0.45, mph };
    }
    if (off >= 55) {
      const q = mph < 10 ? 0.75 : mph < 18 ? 0.5 : 0.3;
      return { type: off >= 90 ? 'cross-offshore' : 'cross-shore', q: off >= 90 ? Math.min(1, q + 0.12) : q, mph };
    }
    return { type: 'onshore', q: mph < 8 ? 0.7 : mph < 14 ? 0.45 : mph < 20 ? 0.25 : 0.12, mph };
  }

  const SKILL = {
    beginner: { lo: 1.5, hi: 3, max: 5.5 },
    intermediate: { lo: 2.5, hi: 6, max: 10 },
    advanced: { lo: 3.5, hi: 10, max: 22 },
  };

  function rate(h, facing, skill) {
    const fm = face(h, facing);
    if (fm === null) return null;
    const ft = fm * M2FT;
    const s = SKILL[skill] || SKILL.intermediate;
    let size, tooBig = false;
    if (ft < s.lo) size = Math.pow(clamp((ft - 0.8) / (s.lo - 0.8), 0, 1), 1.2);
    else if (ft <= s.hi) size = 1;
    else { size = Math.max(0.04, 1 - ((ft - s.hi) / (s.max - s.hi)) * 0.95); tooBig = ft > s.max; }
    const wind = windInfo(h, facing);
    const period = h.swT && (h.swH || 0) >= (h.wwH || 0) * 0.6 ? h.swT : (h.T || h.wwT || 5);
    const pq = clamp((period - 4) / 9, 0.2, 1);
    const score = Math.round(100 * size * (0.3 + 0.7 * wind.q) * (0.55 + 0.45 * pq));
    let label, cls;
    if (ft < 1) { label = 'FLAT'; cls = 'flat'; }
    else if (tooBig) { label = 'TOO BIG'; cls = 'poor'; }
    else if (score < 30) { label = 'POOR'; cls = 'poor'; }
    else if (score < 52) { label = 'FAIR'; cls = 'fair'; }
    else if (score < 75) { label = 'GOOD'; cls = 'good'; }
    else { label = 'EPIC'; cls = 'epic'; }
    return { ft, m: fm, score, label, cls, wind, period, tooBig };
  }

  // Best stretch of daylight for each day (from index `from` onward).
  function windows(data, facing, skill, from) {
    const rated = data.hours.map((h) => rate(h, facing, skill));
    const out = [];
    data.days.forEach((day) => {
      let peak = -1, peakScore = -1;
      for (let i = day.d * 24; i < day.d * 24 + 24 && i < rated.length; i++) {
        if (i < from || !data.hours[i].light || !rated[i]) continue;
        // a 2-hour average keeps a single fluke hour from winning
        const nxt = rated[i + 1] && data.hours[i + 1].light && data.hours[i + 1].day === day.d ? rated[i + 1].score : rated[i].score;
        const sc = (rated[i].score + nxt) / 2;
        if (sc > peakScore) { peakScore = sc; peak = i; }
      }
      if (peak < 0) { out.push(null); return; }
      let a = peak, b = peak + 1;
      const ok = (i) => i >= from && i >= day.d * 24 && i < day.d * 24 + 24 && rated[i] &&
        data.hours[i].light && rated[i].score >= rated[peak].score * 0.85;
      while (b - a < 4 && (ok(b) || ok(a - 1))) {
        if (ok(b)) b++;
        else a--;
      }
      let sum = 0, ft = 0;
      for (let i = a; i < b; i++) { sum += rated[i].score; ft += rated[i].ft; }
      const mid = rated[Math.min(b - 1, a + ((b - a) >> 1))];
      out.push({ d: day.d, a, b, score: sum / (b - a), ft: ft / (b - a), label: mid.label, cls: mid.cls, wind: mid.wind, period: mid.period });
    });
    return { rated, wins: out };
  }

  function tide(data, i) {
    const hs = data.hours;
    if (!hs[i]) return null;
    if (data.hilo) {
      const t = i === data.now ? data.nowMin : naiveMin(hs[i].time);
      const level = tideAt(data.hilo, t);
      if (level === null) return null;
      const nx = data.hilo.find((p) => p.t > t);
      return {
        level, real: true, rising: nx ? nx.type === 'H' : true,
        turn: nx ? { type: nx.type === 'H' ? 'high' : 'low', label: clock(nx.t), v: nx.v } : null,
      };
    }
    if (hs[i].tide === null) return null;
    const next = hs[i + 1] && hs[i + 1].tide !== null ? hs[i + 1].tide : hs[i].tide;
    const rising = next >= hs[i].tide;
    let turn = null;
    for (let j = i + 1; j < hs.length - 1 && j < i + 14; j++) {
      const a = hs[j - 1].tide, b = hs[j].tide, c = hs[j + 1].tide;
      if (a === null || b === null || c === null) break;
      if (rising && b >= a && b > c) { turn = { type: 'high', label: clock(hs[j].hour * 60), v: b }; break; }
      if (!rising && b <= a && b < c) { turn = { type: 'low', label: clock(hs[j].hour * 60), v: b }; break; }
    }
    return { level: hs[i].tide, rising, turn };
  }

  return { load, rate, windows, tide, confidence, M2FT };
})();
