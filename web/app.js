// SurfPlace (phone layout): one clear answer first, details underneath.
(() => {
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('surfplace.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('surfplace.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  const state = {
    spot: null,
    skill: store.get('skill', 'intermediate'),
    units: store.get('units', 'us'),
    data: null, rated: [], wins: [],
    openDay: null, selHour: 0, loadId: 0,
    map: null,
  };

  // ---------- words and numbers ----------
  const us = () => state.units === 'us';
  const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const compass = (d) => COMPASS[Math.round(d / 45) % 8];
  const hourLabel = (h) => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? ' AM' : ' PM');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function sizeText(m) {
    const ft = m * Forecast.M2FT;
    if (ft < 0.8) return 'Flat';
    if (us()) {
      const lo = Math.max(1, Math.round(ft * 0.85));
      return lo + '-' + Math.max(lo + 1, Math.round(ft * 1.15)) + ' ft';
    }
    return (m * 0.85).toFixed(1) + '-' + (m * 1.15).toFixed(1) + ' m';
  }
  const height = (m) => (us() ? (m * Forecast.M2FT).toFixed(1) + ' ft' : m.toFixed(1) + ' m');
  const speed = (kmh) => (us() ? Math.round(kmh * 0.621371) + ' mph' : Math.round(kmh) + ' km/h');
  const temp = (c) => (c === null ? '--' : us() ? Math.round(c * 9 / 5 + 32) + '°F' : Math.round(c) + '°C');
  const dist = (km) => (us() ? Math.round(km * 0.621) + ' miles' : km + ' km');

  function bodyHeight(ft) {
    if (ft < 1) return 'no';
    if (ft < 2) return 'ankle-high';
    if (ft < 3) return 'knee-high';
    if (ft < 4) return 'waist-high';
    if (ft < 5.5) return 'chest-high';
    if (ft < 7) return 'head-high';
    if (ft < 10) return 'overhead';
    if (ft < 15) return 'huge';
    return 'giant';
  }
  function windPlain(w) {
    const s = w.mph < 5 ? '' : w.mph < 12 ? 'light ' : w.mph < 20 ? 'medium ' : 'strong ';
    switch (w.type) {
      case 'glassy': return 'almost no wind, smooth water';
      case 'offshore': return s + 'wind blowing out to sea, which keeps waves clean';
      case 'cross-offshore': return s + 'wind blowing mostly out to sea, fairly clean';
      case 'cross-shore': return s + 'sideways wind, a little bumpy';
      case 'onshore': return s + 'wind blowing in from the sea, which makes waves messy';
      default: return s + 'wind';
    }
  }
  function dayName(d, long) {
    if (d === 0) return 'TODAY';
    if (d === 1 && long) return 'TOMORROW';
    const [y, m, dd] = state.data.days[d].date.split('-').map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString('en-US', { weekday: long ? 'long' : 'short' }).toUpperCase();
  }
  function weather(code) {
    if (code === 0) return 'clear sky';
    if (code <= 2) return 'partly cloudy';
    if (code === 3) return 'cloudy';
    if (code <= 48) return 'foggy';
    if (code <= 57) return 'drizzle';
    if (code <= 67) return 'rain';
    if (code <= 77) return 'snow';
    if (code <= 82) return 'showers';
    if (code <= 86) return 'snow showers';
    return 'thunderstorms — stay out of the water';
  }
  function suit(c) {
    if (c === null) return 'no water temperature here';
    if (c >= 24) return 'boardshorts are fine';
    if (c >= 20) return 'wear a thin spring suit';
    if (c >= 16) return 'wear a 3/2 wetsuit';
    if (c >= 12) return 'wear a 4/3 wetsuit and boots';
    if (c >= 8) return 'wear a 5/4 wetsuit, boots, gloves and hood';
    return 'wear your thickest hooded wetsuit, boots and mitts';
  }
  function board(ft) {
    if (ft < 1) return ['No board', 'Nothing to ride. Good day for a swim.'];
    if (ft < 2.5) return ['Longboard', 'Small waves need a big, floaty board.'];
    if (ft < 4.5) return state.skill === 'beginner'
      ? ['Soft-top', 'Stay in the whitewater close to shore.']
      : ['Fish or funboard', 'Or your everyday shortboard.'];
    if (ft < 7) return state.skill === 'beginner'
      ? ['Stay on the beach', 'These waves are too much for learning.']
      : ['Shortboard', 'Good size for a normal shortboard.'];
    if (ft < 12) return ['Step-up board', 'Bring a longer board for the extra size.'];
    return ['Big-wave gun', 'Experts only, and never alone.'];
  }
  const CHIP = { FLAT: 'FLAT', POOR: 'POOR', FAIR: 'OK', GOOD: 'GOOD', EPIC: 'EPIC', 'TOO BIG': 'TOO BIG' };
  const SURE = ['', 'Rough guess', 'Likely', 'Very likely'];
  const WIND_WORD = { glassy: 'Calm', offshore: 'Clean', 'cross-offshore': 'Mostly clean', 'cross-shore': 'Bumpy', onshore: 'Messy', light: 'Light', breezy: 'Breezy', strong: 'Strong' };
  const WIND_WHY = {
    glassy: 'Smooth water', offshore: 'Blowing out to sea', 'cross-offshore': 'Mostly out to sea',
    'cross-shore': 'Blowing sideways', onshore: 'Blowing in off the sea', light: 'Light wind', breezy: 'Some chop', strong: 'Rough water',
  };
  // "6–10 AM" or "10 AM–2 PM"
  function rangeShort(w) {
    const hs = state.data.hours, a = hs[w.a].hour, b = (hs[w.b - 1].hour + 1) % 24;
    const n = (h) => (h % 12 === 0 ? 12 : h % 12), ap = (h) => (h < 12 ? 'AM' : 'PM');
    return ap(a) === ap(b) ? n(a) + '–' + n(b) + ' ' + ap(b) : n(a) + ' ' + ap(a) + '–' + n(b) + ' ' + ap(b);
  }
  const arrow = (fromDeg) => '<span class="arrow" aria-hidden="true"><svg viewBox="0 0 8 8" shape-rendering="crispEdges" style="transform:rotate(' +
    ((fromDeg + 180) % 360) + 'deg)"><path fill="currentColor" d="M3 8V4H1V3h1V2h1V1h1V0h1v1h1v1h1v1h1v1H5v4z"/></svg></span>';
  function ago(time) {
    const min = Math.max(0, Math.round((Date.now() - time) / 60000));
    return min < 60 ? min + ' minutes ago' : Math.floor(min / 60) + ' h ' + (min % 60) + ' min ago';
  }
  function winText(w) {
    const hs = state.data.hours;
    return hourLabel(hs[w.a].hour) + ' to ' + hourLabel((hs[w.b - 1].hour + 1) % 24);
  }
  function measuredWater(h) {
    const lv = state.data.live;
    return !!(lv && lv.water && Math.abs(h.i - state.data.now) <= 48);
  }
  const waterC = (h) => (measuredWater(h) ? state.data.live.water.wtmp : h.sst);

  // ---------- tabs ----------
  function go(tab) {
    ['forecast', 'map', 'learn'].forEach((t) => { $('tab-' + t).hidden = t !== tab; });
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.go === tab));
    window.scrollTo(0, 0);
    if (tab === 'map') {
      if (!state.map) {
        state.map = SurfMap.init('map', (spot) => pick(spot, true));
        if (state.spot) SurfMap.select(state.spot, true);
      } else {
        state.map.invalidateSize();
      }
    }
  }

  // ---------- picking a beach ----------
  async function pick(spot, fromMap) {
    state.spot = spot;
    store.set('spot', spot);
    if (state.map) SurfMap.select(spot, !fromMap);
    $('spotName').textContent = spot.name;
    $('spotRegion').textContent = spot.region;
    renderFavs();
    $('status').className = 'status';
    $('status').textContent = 'Checking the ocean...';
    $('status').hidden = false;
    $('report').hidden = true;
    if (fromMap) go('forecast');
    const id = ++state.loadId;
    try {
      const data = await Forecast.load(spot);
      if (id !== state.loadId) return;
      state.data = data;
      state.openDay = null;
      compute();
      render();
      $('status').hidden = true;
      $('report').hidden = false;
    } catch (e) {
      if (id !== state.loadId) return;
      state.data = null;
      $('status').className = 'status err';
      $('status').textContent = e.message === 'NO_OCEAN'
        ? 'There is no ocean there. Tap CHANGE and pick a spot on the water.'
        : 'Could not reach the forecast. Check your internet, then tap CHANGE and pick the beach again.';
    }
  }

  function compute() {
    const r = Forecast.windows(state.data, state.spot.facing, state.skill, state.data.now);
    state.rated = r.rated;
    state.wins = r.wins;
  }

  function render() {
    if (!state.data) return;
    renderHero();
    renderBest();
    renderNow();
    renderWeek();
    renderTrust();
  }

  // ---------- the big answer ----------
  function focusDay() { return state.wins[0] ? 0 : 1; }

  function renderHero() {
    const d = state.data, fd = focusDay(), w = state.wins[fd];
    $('heroWhen').textContent = fd === 0 ? 'TODAY' : 'TOMORROW';
    if (!w) {
      $('hero').className = 'hero r-flat';
      $('heroAnswer').textContent = 'NO DATA';
      $('heroWhy').textContent = 'There is no forecast for this spot right now.';
      $('heroFacts').innerHTML = '';
      return;
    }
    let word, why;
    if (w.label === 'FLAT') { word = 'NO'; why = 'It is flat. No waves to ride.'; }
    else if (w.label === 'TOO BIG') { word = 'NO'; why = 'Too big for your level. Watch from the beach.'; }
    else if (w.label === 'POOR') {
      word = 'NOT REALLY';
      why = w.wind.q < 0.5 ? 'There are waves, but the wind is making them messy.' : 'The waves are small and weak.';
    }
    else if (w.label === 'FAIR') { word = 'MAYBE'; why = 'It is OK. Not great, but rideable.'; }
    else if (w.label === 'GOOD') { word = 'YES'; why = 'Good waves. Go surf.'; }
    else { word = 'YES! GO!'; why = 'It does not get better than this.'; }
    $('heroFacts').innerHTML = w.ft < 1 ? '' :
      '<div class="fact"><i>BEST TIME</i><b>' + rangeShort(w) + '</b></div>' +
      '<div class="fact"><i>WAVES</i><b>' + sizeText(w.ft / Forecast.M2FT) + '</b><span>' + bodyHeight(w.ft) + '</span></div>' +
      '<div class="fact"><i>WIND</i><b>' + WIND_WORD[w.wind.type] + '</b><span>' + speed(w.wind.mph * 1.609344) + '</span></div>';
    $('hero').className = 'hero r-' + w.cls;
    $('heroAnswer').textContent = word;
    $('heroWhy').textContent = why;
    Scene.set({ ft: w.ft, cls: w.cls, wind: w.wind.type, mph: w.wind.mph, sky: d.hours[w.a].dusk ? 'dusk' : 'day' });
  }

  function renderBest() {
    const d = state.data, fd = focusDay();
    const trust = (w) => w.score * (w.d < 3 ? 1 : w.d < 5 ? 0.92 : 0.82);
    let top = null;
    state.wins.filter(Boolean).forEach((w) => { if (!top || trust(w) > trust(top) + 3) top = w; });
    if (!top || top.score < 30 || top.label === 'TOO BIG') {
      $('bestMain').textContent = 'NO GOOD SURF THIS WEEK';
      $('bestSub').textContent = 'Nothing worth it in the next 7 days here. Tap CHANGE at the top to try another beach.';
      return;
    }
    if (top.d === fd) {
      $('bestMain').textContent = (fd === 0 ? 'TODAY' : 'TOMORROW') + ' IS THE ONE';
      $('bestSub').textContent = 'Nothing better is coming in the next 7 days.';
      return;
    }
    const conf = Forecast.confidence(d, top.d);
    $('bestMain').textContent = dayName(top.d, true) + ', ' + rangeShort(top);
    $('bestSub').textContent = cap(bodyHeight(top.ft)) + ' waves (' + sizeText(top.ft / Forecast.M2FT).toLowerCase() + '), ' +
      WIND_WORD[top.wind.type].toLowerCase() + ' wind. ' + SURE[conf.level] + '.';
  }

  // ---------- right now ----------
  function renderNow() {
    const d = state.data, i = d.now, h = d.hours[i], r = state.rated[i];
    if (!r) { $('now').innerHTML = ''; return; }
    const tide = Forecast.tide(d, i), fw = state.wins[focusDay()];
    const bd = board(fw ? fw.ft : r.ft);
    const rows = [
      ['WAVES', r.ft < 1 ? 'Flat' : sizeText(r.m), r.ft < 1 ? 'Nothing to ride' : cap(bodyHeight(r.ft))],
      ['WIND', WIND_WORD[r.wind.type] + arrow(h.windDir), WIND_WHY[r.wind.type] + ', ' + speed(h.wind)],
      ['TIDE', tide ? (tide.rising ? 'Coming in' : 'Going out') : '--',
        tide ? (tide.turn ? cap(tide.turn.type) + ' tide at ' + tide.turn.label : '') : 'No tide information here'],
      ['WATER', temp(waterC(h)), cap(suit(waterC(h)))],
      ['AIR', temp(h.air), cap(weather(h.code)) + (h.light ? '' : ', dark right now')],
      ['BOARD', bd[0], bd[1]],
    ];
    $('now').innerHTML = rows.map((x) =>
      '<div class="row"><div class="row-k">' + x[0] + '</div><div class="row-v"><b>' + x[1] + '</b><span>' + esc(x[2]) + '</span></div></div>').join('');
  }

  // ---------- this week ----------
  function renderWeek() {
    const d = state.data;
    $('week').innerHTML = d.days.map((day) => {
      const w = state.wins[day.d], open = state.openDay === day.d;
      const good = w && w.score >= 30 && w.label !== 'TOO BIG';
      let html = '<button class="wk" data-day="' + day.d + '" aria-expanded="' + open + '">' +
        '<span class="wk-day">' + dayName(day.d) + '</span>' +
        '<span class="chip r-' + (w ? w.cls : 'flat') + '">' + (w ? CHIP[w.label] : 'DARK') + '</span>' +
        '<span class="wk-info"><b>' + (w ? sizeText(w.ft / Forecast.M2FT) : 'Day is over') + '</b></span>' +
        '<span class="wk-time">' + (good ? rangeShort(w) : '') + '</span></button>';
      if (open) html += detail(day.d);
      return html;
    }).join('');
  }

  function detail(dnum) {
    const d = state.data, start = dnum * 24;
    const maxFt = Math.max(4, ...state.rated.slice(start, start + 24).map((r) => (r ? r.ft : 0))) * 1.08;
    let bars = '';
    for (let i = start; i < start + 24 && i < d.hours.length; i++) {
      const h = d.hours[i], r = state.rated[i];
      bars += '<button class="hr' + (h.light ? '' : ' night') + (i === state.selHour ? ' sel' : '') + '" data-i="' + i +
        '" aria-label="' + hourLabel(h.hour) + '"><div class="bar r-' + (r ? r.cls : 'flat') + '" style="height:' +
        (r ? Math.max(4, Math.round((r.ft / maxFt) * 100)) : 4) + '%"></div></button>';
    }
    return '<div class="wk-detail"><div class="hours">' + bars + '</div>' +
      '<div class="hour-labels"><span>12a</span><span>3a</span><span>6a</span><span>9a</span><span>12p</span><span>3p</span><span>6p</span><span>9p</span></div>' +
      '<p class="hour-read">' + hourRead(state.selHour) + '</p>' +
      '<p class="night-note">Tap a bar. Taller = bigger waves, colour = how good, faded = dark. Forecast for this day: ' +
      SURE[Forecast.confidence(d, dnum).level].toLowerCase() + '.</p></div>';
  }

  function hourRead(i) {
    const h = state.data.hours[i], r = state.rated[i];
    if (!r) return 'No forecast for this hour.';
    return '<b>' + hourLabel(h.hour) + ' — ' + CHIP[r.label] + '</b>' +
      (r.ft < 1 ? 'Flat. ' : sizeText(r.m) + ', ' + bodyHeight(r.ft) + '. ') +
      cap(windPlain(r.wind)) + ' (' + speed(h.wind) + ').' + (h.light ? '' : ' Dark outside.');
  }

  // ---------- can I trust this ----------
  function renderTrust() {
    const d = state.data, lv = d.live;
    let html = '';
    if (lv && lv.buoy) {
      const b = lv.buoy;
      html += '<p><b>REAL MEASUREMENT</b><a href="https://www.ndbc.noaa.gov/station_page.php?station=' + esc(b.id) +
        '" target="_blank" rel="noopener">NOAA buoy ' + esc(b.id) + '</a>, ' + dist(b.km) + ' from this beach, measured ' +
        height(b.wvht) + ' waves ' + ago(b.time) + '.</p>';
      if (d.cal) {
        const off = Math.round((d.cal.raw - 1) * 100);
        html += '<p><b>FORECAST CHECK</b>' + (Math.abs(off) <= 8
          ? 'The forecast matched the buoy. It is on target right now.'
          : 'The forecast was ' + Math.abs(off) + '% too ' + (off > 0 ? 'small' : 'big') +
            ' compared with the buoy, so today and tomorrow have been corrected.') + '</p>';
      }
    } else if (lv) {
      html += '<p><b>NO BUOY NEARBY</b>No wave buoy is reporting near this beach, so this is forecast only. Treat it as a guide.</p>';
    } else {
      html += '<p><b>NO LIVE FEED</b>Live buoy and tide readings could not be reached just now, so this is forecast only. Pick the beach again in a minute.</p>';
    }
    html += '<p><b>TIDES</b>' + (d.hilo
      ? 'Official NOAA tide times from ' + esc(d.tideName) + '.'
      : 'Estimated from an ocean model. Times can be off by an hour or so.') + '</p>';
    html += '<p><b>WAVES AND WIND</b>' + (d.modelCount > 1
      ? d.modelCount + ' separate wave forecasts are compared. When they agree a day is marked "very likely", when they disagree it is a "rough guess".'
      : 'One wave forecast is available here, so later days are a rough guess.') + '</p>';
    html += '<p><b>KEEP IN MIND</b>Wave size at the beach is an estimate' +
      (state.spot.custom ? ', and a custom spot does not know which way the beach faces' : '') +
      '. The next 3 days are the most reliable.</p>';
    $('trust').innerHTML = html;
  }

  // ---------- saved beaches ----------
  let favs = store.get('favs', []);
  const sameSpot = (a, b) => a && b && a.name === b.name && a.region === b.region;
  function renderFavs() {
    $('favBtn').setAttribute('aria-pressed', favs.some((f) => sameSpot(f, state.spot)));
    $('favs').hidden = !favs.length;
    $('favs').innerHTML = favs.map((f, i) =>
      '<button data-fav="' + i + '" class="' + (sameSpot(f, state.spot) ? 'on' : '') + '">' + esc(f.name) + '</button>').join('');
  }
  $('favBtn').addEventListener('click', () => {
    if (!state.spot) return;
    const at = favs.findIndex((f) => sameSpot(f, state.spot));
    if (at >= 0) favs.splice(at, 1); else favs.push(state.spot);
    store.set('favs', favs);
    renderFavs();
  });

  // ---------- browse by state / country ----------
  (function fillRegions() {
    const count = {};
    BEACHES.forEach((b) => { count[b.region] = (count[b.region] || 0) + 1; });
    const isUS = (n) => / USA$|Hawaii$|^Puerto Rico$/.test(n);
    const names = Object.keys(count).sort((a, b) => (isUS(a) === isUS(b) ? a.localeCompare(b) : isUS(a) ? -1 : 1));
    $('regionSel').innerHTML = '<option value="">Browse by state or country...</option>' +
      names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + ' (' + count[n] + ')</option>').join('');
  })();
  $('regionSel').addEventListener('change', () => {
    const r = $('regionSel').value;
    $('regionList').innerHTML = !r ? '' : BEACHES.filter((b) => b.region === r)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((b) => '<li data-id="' + b.id + '">' + esc(b.name) + '</li>').join('');
  });

  // ---------- taps ----------
  function syncButtons() {
    document.querySelectorAll('[data-skill]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.skill === state.skill));
    document.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.units === state.units));
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, li[data-id]');
    if (!b) { $('results').hidden = true; return; }
    if (b.id === 'favBtn') {
      return; // has its own handler
    } else if (b.dataset.fav !== undefined) {
      if (favs[+b.dataset.fav]) pick(favs[+b.dataset.fav], false);
    } else if (b.dataset.go) {
      go(b.dataset.go);
    } else if (b.dataset.skill) {
      state.skill = b.dataset.skill; store.set('skill', state.skill); syncButtons();
      if (state.data) { compute(); render(); }
    } else if (b.dataset.units) {
      state.units = b.dataset.units; store.set('units', state.units); syncButtons(); render();
    } else if (b.dataset.day !== undefined && state.data) {
      const dn = +b.dataset.day;
      if (state.openDay === dn) { state.openDay = null; } else {
        state.openDay = dn;
        const w = state.wins[dn];
        state.selHour = w ? w.a : dn === 0 ? state.data.now : dn * 24 + 12;
      }
      renderWeek();
    } else if (b.dataset.i !== undefined && state.data) {
      state.selHour = +b.dataset.i;
      document.querySelectorAll('.hr').forEach((x) => x.classList.toggle('sel', x === b));
      document.querySelector('.hour-read').innerHTML = hourRead(state.selHour);
    } else if (b.dataset.id) {
      const spot = BEACHES.find((x) => x.id === b.dataset.id);
      $('results').hidden = true; $('search').value = ''; $('search').blur();
      if (spot) pick(spot, true);
    }
  });

  // ---------- search ----------
  const kmBetween = (la1, lo1, la2, lo2) => {
    const rad = Math.PI / 180;
    const a = Math.sin((la2 - la1) * rad / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin((lo2 - lo1) * rad / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  };
  function showResults() {
    const q = $('search').value.trim().toLowerCase(), box = $('results');
    let hits;
    if (q) {
      // names that start with what was typed come first, then famous spots
      const rank = (b) => (b.name.toLowerCase().indexOf(q) === 0 ? 0 : 2) + (b.top ? 0 : 1);
      hits = BEACHES.filter((b) => (b.name + ' ' + b.region).toLowerCase().includes(q))
        .sort((a, b) => rank(a) - rank(b)).slice(0, 25);
    } else if (state.spot) {
      // nothing typed yet: offer the beaches closest to the current one
      hits = BEACHES.filter((b) => b.id !== state.spot.id)
        .map((b) => ({ b, km: kmBetween(state.spot.lat, state.spot.lon, b.lat, b.lon) }))
        .sort((x, y) => x.km - y.km).slice(0, 8).map((x) => x.b);
    } else hits = [];
    box.innerHTML = hits.length
      ? hits.map((b) => '<li data-id="' + b.id + '">' + esc(b.name) + '<span>' + esc(b.region) + '</span></li>').join('')
      : '<li>No beach by that name. Tap the coast on the map instead.</li>';
    box.hidden = false;
  }
  $('search').addEventListener('input', showResults);
  $('search').addEventListener('focus', showResults);
  $('search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = $('results').querySelector('li[data-id]'); if (first) first.click(); }
    if (e.key === 'Escape') $('results').hidden = true;
  });

  $('nearMe').addEventListener('click', () => {
    const hint = $('mapHint');
    hint.textContent = 'Finding the closest surf beach...';
    Live.locate().then((pos) => {
      // your location stays on this phone: it is only compared with the beach list
      let best = null, bestD = Infinity;
      BEACHES.forEach((b) => {
        const k = kmBetween(pos.lat, pos.lon, b.lat, b.lon);
        if (k < bestD) { bestD = k; best = b; }
      });
      hint.textContent = 'Closest surf beach: ' + best.name + ', about ' + dist(Math.round(bestD)) + ' away.';
      pick(best, true);
    }).catch(() => {
      hint.textContent = 'Location is off or blocked. Search or tap a flag instead.';
    });
  });

  // ---------- logo + learn ----------
  function drawLogo() {
    const art = [
      '................', '................', '.....wwww.......', '...wwbbbbww.....',
      '..wbbbbbbbbw....', '.wbbbddddbbbw...', '.wbbd....dbbw...', 'wbbd......dbw...',
      'wbbd.......ww...', 'wbbbd...........', 'wbbbbd..........', 'wbbbbbdd......ww',
      'bbbbbbbbddddwwbb', 'bbbbbbbbbbbbbbbb', 'dbbbbbbbbbbbbbbd', 'dddddddddddddddd',
    ];
    const col = { w: '#ffffff', b: '#1e9bd7', d: '#1479b8' };
    const c = $('logo').getContext('2d');
    art.forEach((row, y) => { for (let x = 0; x < 16; x++) if (col[row[x]]) { c.fillStyle = col[row[x]]; c.fillRect(x, y, 1, 1); } });
  }
  // topics grouped under headings, each one folds open so the page is not a wall of text
  (function renderKnowledge() {
    const groups = [];
    KNOWLEDGE.forEach((k) => {
      const g = k.g || 'THE BASICS';
      let at = groups.find((x) => x.name === g);
      if (!at) groups.push((at = { name: g, items: [] }));
      at.items.push(k);
    });
    $('knowledge').innerHTML = groups.map((g) =>
      '<h3 class="k-group">' + esc(g.name) + '</h3>' + g.items.map((k) =>
        '<details class="card k-card"><summary>' + esc(k.t) + '</summary><div class="k-body">' +
        (k.p ? '<p>' + esc(k.p) + '</p>' : '') +
        '<ul>' + k.l.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></details>').join('')).join('');
  })();

  // ---------- go ----------
  drawLogo();
  syncButtons();
  Scene.init($('scene'));
  const saved = store.get('spot', null);
  const known = saved && (saved.custom ? saved : BEACHES.find((b) => b.name === saved.name && b.region === saved.region));
  pick(known || BEACHES[0], false);
  setInterval(() => { if (state.spot && !document.hidden && state.openDay === null) pick(state.spot, false); }, 30 * 60 * 1000);
})();
