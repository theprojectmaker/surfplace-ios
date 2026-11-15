// The little pixel "surf cam": a wave whose size follows the forecast, with a surfer on it.
const Scene = (() => {
  const W = 200, H = 72, HORIZON = 26, BASE = 56;
  let ctx, t = 0, st = { ft: 0, cls: 'flat', wind: 'glassy', mph: 0, sky: 'day' };

  const SKY = {
    day: ['#6fcdf7', '#93dcfb', '#b9ebff', '#d9f6ff'],
    dusk: ['#5b6fc4', '#c77fb4', '#ff9d7a', '#ffd08a'],
    night: ['#081a36', '#0b2545', '#12305a', '#1a3d6e'],
  };
  const SEA = {
    day: ['#1e9bd7', '#1784c4', '#7fd8f5'],
    dusk: ['#2a7fc0', '#1f69aa', '#ffc9a0'],
    night: ['#0f3f73', '#0b3160', '#3f78b3'],
  };

  const RIDER = [
    '...hh....',
    '...ss....',
    '.s.rr....',
    '..rrrs...',
    '...rr....',
    '..nnn....',
    '..s..s...',
    'wwwwwwwww',
  ];
  const SITTER = [
    '....hh...',
    '....ss...',
    '...rrr...',
    '...rrr...',
    'wwwwwwwww',
  ];
  const INK = { h: '#3b2a1a', s: '#f2b98a', r: '#ff6b4a', n: '#0b2545', w: '#fff3b0' };

  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); }

  function sprite(rows, x, y) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = INK[row[i]];
        if (c) px(x + i, y + j, 1, 1, c);
      }
    });
  }

  // wave shape: steep face on the left (toward shore), long back on the right
  function profile(u) {
    if (u < 0.22) { const k = u / 0.22; return k * k * (3 - 2 * k); }
    const k = 1 - (u - 0.22) / 0.78;
    return k * k;
  }

  function draw() {
    t++;
    const sky = SKY[st.sky], sea = SEA[st.sky];
    for (let b = 0; b < 4; b++) px(0, (b * HORIZON) / 4, W, HORIZON / 4 + 1, sky[b]);
    if (st.sky === 'night') {
      for (let i = 0; i < 16; i++) px((i * 53) % W, (i * 17) % (HORIZON - 3), 1, 1, (i + (t >> 3)) % 5 ? '#fff' : '#7f9cc4');
      px(164, 5, 8, 8, '#f4f1de'); px(167, 5, 5, 5, sky[0]);
    } else {
      const sy = st.sky === 'dusk' ? 15 : 4;
      px(162, sy + 2, 12, 8, '#ffd23f'); px(164, sy, 8, 12, '#ffd23f');
    }
    // open sea behind the wave
    px(0, HORIZON, W, H - HORIZON, sea[0]);
    for (let y = HORIZON + 2; y < BASE; y += 4) {
      for (let x = ((y * 7 + (t >> 1)) % 14) - 14; x < W; x += 14) px(x, y, 4 + (y % 3), 1, sea[2]);
    }
    // onshore wind = whitecaps and chop everywhere
    if (st.wind === 'onshore' && st.mph > 8) {
      for (let i = 0; i < 14; i++) px((i * 37 + t * 2) % W, HORIZON + 3 + ((i * 11) % 26), 3, 1, '#fff');
    }

    const amp = st.ft < 1 ? 2 : Math.max(4, Math.min(38, st.ft * 3.4));
    const off = (t * 2) % W;
    let riderX = 0, riderY = 0;
    for (let x = 0; x < W; x++) {
      const u = ((x + off) % W) / W;
      const top = Math.round(BASE - amp * profile(u));
      px(x, top, 1, H - top, sea[1]);
      const steep = u > 0.1 && u < 0.3;
      // face shading + foam line
      px(x, top, 1, steep ? 3 : 1, steep ? '#ffffff' : sea[2]);
      if (!steep && (x + top + t) % 9 < 3) px(x, top + 3, 1, 1, sea[0]);
      if ((x + (t >> 1)) % 11 < 4 && top + 8 < H) px(x, top + 8 + (x % 5), 1, 1, sea[0]);
      if (Math.abs(u - 0.13) < 0.5 / W) { riderX = x; riderY = top; }
    }
    // offshore wind blows spray back over the top of the wave
    if ((st.wind === 'offshore' || st.wind === 'cross-offshore') && st.mph > 6 && st.ft >= 1) {
      const peak = ((0.22 * W - off) % W + W) % W;
      for (let i = 0; i < 9; i++) {
        px((peak + 2 + i * 4 + (t % 4)) % W, BASE - amp - 2 - ((i + t) % 3), 2, 1, '#ffffff');
      }
    }
    // whitewash rolling in ahead of the wave
    const front = ((0.02 * W - off) % W + W) % W;
    for (let i = 0; i < 5; i++) px((front - i * 3 + W) % W, BASE - 1 - ((i + t) % 2), 3, 2, '#fff');

    if (st.ft >= 1) sprite(RIDER, riderX - 4, riderY - 8 + Math.round(amp * 0.12));
    else sprite(SITTER, 96, BASE - 6 + ((t >> 2) % 2));
    // shore
    px(0, H - 3, W, 3, '#f6e2a4');
    for (let x = (t >> 1) % 8; x < W; x += 8) px(x, H - 4, 4, 1, '#fff');
  }

  function init(canvas) {
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    draw();
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) setInterval(draw, 130);
  }

  function set(next) { st = Object.assign({}, st, next); if (ctx) draw(); }

  return { init, set };
})();
