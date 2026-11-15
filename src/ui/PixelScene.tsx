// The little pixel "surf cam": a wave whose size follows the forecast, with a surfer riding it.
// Drawn as a few SVG paths on a 200x72 pixel grid and redrawn ~8 times a second.
import React, { memo, useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { WindType } from '../engine/forecast';

const W = 200, H = 72, HORIZON = 26, BASE = 56;
export type Sky = 'day' | 'dusk' | 'night';

const SKY: Record<Sky, string[]> = {
  day: ['#6fcdf7', '#93dcfb', '#b9ebff', '#d9f6ff'],
  dusk: ['#5b6fc4', '#c77fb4', '#ff9d7a', '#ffd08a'],
  night: ['#081a36', '#0b2545', '#12305a', '#1a3d6e'],
};
const SEA: Record<Sky, string[]> = {
  day: ['#1e9bd7', '#1784c4', '#7fd8f5'],
  dusk: ['#2a7fc0', '#1f69aa', '#ffc9a0'],
  night: ['#0f3f73', '#0b3160', '#3f78b3'],
};
const RIDER = ['...hh....', '...ss....', '.s.rr....', '..rrrs...', '...rr....', '..nnn....', '..s..s...', 'wwwwwwwww'];
const SITTER = ['....hh...', '....ss...', '...rrr...', '...rrr...', 'wwwwwwwww'];
const INK: Record<string, string> = { h: '#3b2a1a', s: '#f2b98a', r: '#ff6b4a', n: '#0b2545', w: '#fff3b0' };

const px = (x: number, y: number, w = 1, h = 1) => 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + -w + 'z';

// steep face on the left (toward shore), long back on the right
function profile(u: number): number {
  if (u < 0.22) { const k = u / 0.22; return k * k * (3 - 2 * k); }
  const k = 1 - (u - 0.22) / 0.78;
  return k * k;
}

type Props = { ft: number; wind: WindType; mph: number; sky: Sky };

function scene(p: Props, t: number) {
  const sea = SEA[p.sky];
  const amp = p.ft < 1 ? 2 : Math.max(4, Math.min(38, p.ft * 3.4));
  const off = (t * 2) % W;

  // wave body + rim + details, column by column
  let body = 'M0 ' + H, white = '', light = '', dot = '', riderX = 0, riderY = BASE;
  const riderCol = Math.round((((0.13 * W - off) % W) + W) % W);
  for (let x = 0; x < W; x++) {
    const u = ((x + off) % W) / W;
    const top = Math.round(BASE - amp * profile(u));
    body += 'L' + x + ' ' + top + 'L' + (x + 1) + ' ' + top;
    const steep = u > 0.1 && u < 0.3;
    if (steep) white += px(x, top, 1, 3); else light += px(x, top);
    if (!steep && (x + top + t) % 9 < 3) dot += px(x, top + 3);
    if ((x + (t >> 1)) % 11 < 4 && top + 8 < H) dot += px(x, top + 8 + (x % 5));
    if (x === riderCol) { riderX = x; riderY = top; }
  }
  body += 'L' + W + ' ' + H + 'Z';

  // open sea behind the wave
  let crest = '';
  for (let y = HORIZON + 2; y < BASE; y += 4) {
    for (let x = ((y * 7 + (t >> 1)) % 14) - 14; x < W; x += 14) crest += px(x, y, 4 + (y % 3), 1);
  }
  // onshore wind = whitecaps; offshore wind = spray blown back off the lip
  let caps = '';
  if (p.wind === 'onshore' && p.mph > 8) for (let i = 0; i < 14; i++) caps += px((i * 37 + t * 2) % W, HORIZON + 3 + ((i * 11) % 26), 3);
  if ((p.wind === 'offshore' || p.wind === 'cross-offshore') && p.mph > 6 && p.ft >= 1) {
    const peak = ((((0.22 * W - off) % W) + W) % W);
    for (let i = 0; i < 9; i++) caps += px((peak + 2 + i * 4 + (t % 4)) % W, BASE - amp - 2 - ((i + t) % 3), 2);
  }
  // whitewash rolling in
  const front = ((((0.02 * W - off) % W) + W) % W);
  for (let i = 0; i < 5; i++) caps += px((front - i * 3 + W) % W, BASE - 1 - ((i + t) % 2), 3, 2);
  // shore foam
  let shore = '';
  for (let x = (t >> 1) % 8; x < W; x += 8) shore += px(x, H - 4, 4);

  // the surfer: riding if there are waves, sitting on the board if flat
  const sprite = p.ft >= 1 ? RIDER : SITTER;
  const sx = p.ft >= 1 ? riderX - 4 : 96, sy = p.ft >= 1 ? riderY - 8 + Math.round(amp * 0.12) : BASE - 6 + ((t >> 2) % 2);
  const byColor: Record<string, string> = {};
  sprite.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (INK[row[i]]) byColor[row[i]] = (byColor[row[i]] || '') + px(sx + i, sy + j);
  });
  return { sea, body, white, light, dot, crest, caps, shore, byColor };
}

function PixelSceneBase(p: Props) {
  const [t, setT] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setT((n) => n + 1), 130);
    return () => clearInterval(id);
  }, [still]);

  const sky = SKY[p.sky];
  const s = scene(p, t);
  const sunY = p.sky === 'dusk' ? 15 : 4;
  return (
    <View style={{ width: '100%', aspectRatio: W / H, backgroundColor: s.sea[0] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none">
        {sky.map((c, i) => <Rect key={i} x={0} y={(i * HORIZON) / 4} width={W} height={HORIZON / 4 + 1} fill={c} />)}
        {p.sky === 'night' ? (
          <>
            <Path fill="#fff" d={Array.from({ length: 16 }, (_, i) => ((i + (t >> 3)) % 5 ? px((i * 53) % W, (i * 17) % (HORIZON - 3)) : '')).join('')} />
            <Rect x={164} y={5} width={8} height={8} fill="#f4f1de" />
            <Rect x={167} y={5} width={5} height={5} fill={sky[0]} />
          </>
        ) : (
          <>
            <Rect x={162} y={sunY + 2} width={12} height={8} fill="#ffd23f" />
            <Rect x={164} y={sunY} width={8} height={12} fill="#ffd23f" />
          </>
        )}
        <Rect x={0} y={HORIZON} width={W} height={H - HORIZON} fill={s.sea[0]} />
        <Path fill={s.sea[2]} d={s.crest} />
        <Path fill={s.sea[1]} d={s.body} />
        <Path fill="#ffffff" d={s.white} />
        <Path fill={s.sea[2]} d={s.light} />
        <Path fill={s.sea[0]} d={s.dot} />
        <Path fill="#ffffff" d={s.caps} />
        {Object.keys(s.byColor).map((k) => <Path key={k} fill={INK[k]} d={s.byColor[k]} />)}
        <Rect x={0} y={H - 3} width={W} height={3} fill="#f6e2a4" />
        <Path fill="#ffffff" d={s.shore} />
      </Svg>
    </View>
  );
}

export const PixelScene = memo(PixelSceneBase);
