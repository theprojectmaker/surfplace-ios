// The live pixel map. One finger drags (and glides when you flick), two fingers pinch about the
// spot between them, double-tap zooms in on the spot you tapped, the + and - buttons zoom
// smoothly. Tap a flag to pick a beach, or tap the coast for the nearest beach (or that exact
// spot). The land and the moving waves are drawn by the app itself from the coastline data.
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { BEACHES, sameSpot } from '../data/beaches';
import { km as distKm } from '../engine/live';
import { Spot } from '../engine/types';
import { clamp, gestureTransform, MapView, viewAfter, zoomAbout, Pt, Xf } from '../map/gesture';
import { COLORS, latToWy, lonToWx, Raster, rasterize, waves, wxToLon, wyToLat } from '../map/raster';
import { fx } from '../sound';
import { C, PX } from '../theme';
import { Box, Icon, Press, T } from './kit';

const CELL = 6;       // one map "pixel" = 6 screen points
const PAD = 0.5;      // extra map drawn around the screen, so dragging and gliding never show a blank edge
const MIN_Z = 2, MAX_Z = 11;
const IDENTITY: Xf = { tx: 0, ty: 0, s: 1 };

type Tap = { x: number; y: number; lat: number; lon: number; beach: Spot | null; km: number };

const StaticLayer = memo(function StaticLayer({ r }: { r: Raster }) {
  const p = r.paths;
  return (
    <Svg width={r.cols * CELL} height={r.rows * CELL} viewBox={'0 0 ' + r.cols + ' ' + r.rows} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={r.cols} height={r.rows} fill={COLORS.sea} />
      <Path fill={COLORS.seaDark} d={p.seaDark} />
      <Path fill={COLORS.shallow} d={p.shallow} />
      <Path fill={COLORS.land} d={p.land} />
      <Path fill={COLORS.landDark} d={p.landDark} />
      <Path fill={COLORS.landLight} d={p.landLight} />
      <Path fill={COLORS.sand} d={p.sand} />
    </Svg>
  );
});

// waves + shore foam: the only part that animates, so only this redraws
const WaveLayer = memo(function WaveLayer({ r, run }: { r: Raster; run: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setT((n) => n + 1), 240);
    return () => clearInterval(id);
  }, [run]);
  const w = waves(r, t);
  return (
    <Svg width={r.cols * CELL} height={r.rows * CELL} viewBox={'0 0 ' + r.cols + ' ' + r.rows} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path fill={COLORS.seaLight} d={w.light} />
      <Path fill="#ffffff" d={w.white} />
    </Svg>
  );
});

function Flag({ x, y, on, name, label, onPress }: { x: number; y: number; on: boolean; name: string; label: boolean; onPress: () => void }) {
  return (
    <>
      <Pressable
        accessibilityRole="button" accessibilityLabel={name} hitSlop={14} onPress={onPress}
        style={{ position: 'absolute', left: x - 4, top: y - 24, width: 20, height: 24, zIndex: on ? 5 : 2 }}
      >
        <View style={{ position: 'absolute', left: 2, top: 0, width: 4, height: 24, backgroundColor: C.ink }} />
        <View style={{ position: 'absolute', left: 6, top: 0, width: on ? 16 : 12, height: on ? 12 : 10, backgroundColor: on ? C.sun : C.coral, borderWidth: 2, borderColor: C.ink }} />
      </Pressable>
      {label || on ? (
        <View pointerEvents="none" style={{
          position: 'absolute', left: x + (on ? 20 : 14), top: y - 28, zIndex: on ? 6 : 3, maxWidth: 200,
          backgroundColor: on ? C.sun : C.foam, borderWidth: 3, borderColor: C.ink, paddingHorizontal: 6,
        }}>
          <T size={18} numberOfLines={1}>{name}</T>
        </View>
      ) : null}
    </>
  );
}

export const PixelMap = memo(function PixelMap({ spot, onPick, active, inset }: { spot: Spot; onPick: (s: Spot) => void; active: boolean; inset: { top: number; bottom: number } }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<MapView>(() => ({ cx: lonToWx(spot.lon), cy: latToWy(spot.lat), z: 10 }));
  const [tap, setTap] = useState<Tap | null>(null);
  const [still, setStill] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);

  // the picture's live offset and scale while a finger is down or an animation runs
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(1)).current;
  const cur = useRef<Xf>({ ...IDENTITY }).current;
  useEffect(() => {
    const a = tx.addListener(({ value }) => { cur.tx = value; });
    const b = ty.addListener(({ value }) => { cur.ty = value; });
    const c = sc.addListener(({ value }) => { cur.s = value; });
    return () => { tx.removeListener(a); ty.removeListener(b); sc.removeListener(c); };
  }, [tx, ty, sc, cur]);

  const viewRef = useRef(view);
  viewRef.current = view;
  const stillRef = useRef(still);
  stillRef.current = still;
  const pad = useRef({ x: 0, y: 0 }).current;
  const box = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0, w: 0, h: 0 }).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  // keep the map centred on the chosen beach when it changes
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setTap(null);
    setView({ cx: lonToWx(spot.lon), cy: latToWy(spot.lat), z: Math.max(viewRef.current.z, 10) });
  }, [spot]);

  // a new view means the artwork was redrawn: drop the drag/pinch offsets in the same frame
  useLayoutEffect(() => { tx.setValue(0); ty.setValue(0); sc.setValue(1); }, [view, tx, ty, sc]);

  const commit = useCallback((t: Pt, s: number) => { setView(viewAfter(viewRef.current, t, s, MIN_Z, MAX_Z)); }, []);

  // glide / zoom animation of the picture, then redraw at the new place
  const animateTo = useCallback((t: Pt, s: number, ms: number) => {
    anim.current?.stop();
    const run = Animated.parallel([
      Animated.timing(tx, { toValue: t.x, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(ty, { toValue: t.y, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(sc, { toValue: s, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    anim.current = run;
    run.start(({ finished }) => { if (finished && anim.current === run) { anim.current = null; commit(t, s); } });
    // safety net: if the animation never finishes (app sent to the background, say), still land on the new view
    setTimeout(() => { if (anim.current === run) { run.stop(); anim.current = null; commit(t, s); } }, ms + 400);
  }, [commit, sc, tx, ty]);

  // zoom by `d` levels, about a point (relative to the centre of the view) if given
  const zoomStep = useCallback((d: number, focus?: Pt) => {
    const v = viewRef.current;
    const nz = clamp(v.z + d, MIN_Z, MAX_Z);
    const s = Math.pow(2, nz - v.z);
    if (Math.abs(s - 1) < 1e-6) return;
    const xf = zoomAbout(focus || { x: 0, y: 0 }, s);
    setTap(null);
    if (stillRef.current) commit({ x: xf.tx, y: xf.ty }, xf.s);
    else animateTo({ x: xf.tx, y: xf.ty }, xf.s, 230);
  }, [animateTo, commit]);

  // ---- finger gestures ----
  const g = useRef({ base: { ...IDENTITY } as Xf, f0: { x: 0, y: 0 }, d0: 0, n: 0 }).current;
  const touchInfo = (e: { nativeEvent: { touches?: ArrayLike<{ pageX: number; pageY: number }> } }, st: { moveX: number; moveY: number; x0: number; y0: number }, grant: boolean) => {
    const t = e.nativeEvent.touches;
    const n = t && t.length ? t.length : 1;
    let x: number, y: number, d = 0;
    if (t && t.length >= 2) {
      x = (t[0].pageX + t[1].pageX) / 2; y = (t[0].pageY + t[1].pageY) / 2;
      d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
    } else { x = grant ? st.x0 : st.moveX; y = grant ? st.y0 : st.moveY; }
    return { n, d, m: { x: x - origin.x - origin.w / 2, y: y - origin.y - origin.h / 2 } };
  };

  const responder = useMemo(() => {
    const wants = (e: { nativeEvent: { touches?: ArrayLike<unknown> } }, s: { dx: number; dy: number }) =>
      (e.nativeEvent.touches ? e.nativeEvent.touches.length >= 2 : false) || Math.abs(s.dx) > 6 || Math.abs(s.dy) > 6;
    const end = (_e: unknown, st: { vx: number; vy: number }) => {
      const t = { x: cur.tx, y: cur.ty }, s = cur.s;
      const speed = Math.hypot(st.vx, st.vy);
      if (g.n <= 1 && !stillRef.current && speed > 0.35 && Math.abs(s - 1) < 0.02) {
        // a flick: let the map glide on a little, but never past the part that is drawn
        const target = { x: clamp(t.x + st.vx * 260, -pad.x * 0.9, pad.x * 0.9), y: clamp(t.y + st.vy * 260, -pad.y * 0.9, pad.y * 0.9) };
        animateTo(target, s, 380);
      } else commit(t, s);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, s) => wants(e, s),
      onMoveShouldSetPanResponderCapture: (e, s) => wants(e, s),
      onPanResponderGrant: (e, st) => {
        box.current?.measureInWindow((x, y, w, h) => { origin.x = x; origin.y = y; origin.w = w; origin.h = h; });
        setTap(null);
        if (anim.current) { anim.current.stop(); anim.current = null; commit({ x: cur.tx, y: cur.ty }, cur.s); } // grabbed mid-glide
        const r = touchInfo(e, st, true);
        g.base = { ...IDENTITY }; g.f0 = r.m; g.d0 = r.d; g.n = r.n;
      },
      onPanResponderMove: (e, st) => {
        const r = touchInfo(e, st, false);
        if (r.n !== g.n) { // a finger landed or lifted: carry on from where the picture is now
          g.base = { tx: cur.tx, ty: cur.ty, s: cur.s }; g.f0 = r.m; g.d0 = r.d; g.n = r.n;
          return;
        }
        const zl = viewRef.current.z;
        const sMin = Math.pow(2, MIN_Z - zl), sMax = Math.pow(2, MAX_Z - zl);
        let k = r.n >= 2 && g.d0 > 0 ? r.d / g.d0 : 1;
        const s = clamp(g.base.s * k, sMin, sMax);
        k = s / g.base.s;
        const x = gestureTransform(g.base, g.f0, r.m, k);
        tx.setValue(x.tx); ty.setValue(x.ty); sc.setValue(x.s);
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateTo, commit]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: Math.round(width), h: Math.round(height) }));
    box.current?.measureInWindow((x, y, w, h) => { origin.x = x; origin.y = y; origin.w = w; origin.h = h; });
  };

  const cols = Math.ceil((size.w * (1 + 2 * PAD)) / CELL), rows = Math.ceil((size.h * (1 + 2 * PAD)) / CELL);
  const padX = (cols * CELL - size.w) / 2, padY = (rows * CELL - size.h) / 2;
  pad.x = padX; pad.y = padY;
  const S = 256 * Math.pow(2, view.z);

  const raster = useMemo(() => (size.w > 0 ? rasterize(view.cx, view.cy, view.z, cols, rows, CELL) : null), [view, cols, rows, size.w]);

  // lat/lon -> position inside the (padded) map container
  const project = useCallback((lat: number, lon: number) => {
    let dx = lonToWx(lon) - view.cx;
    dx -= Math.round(dx);
    return { x: size.w / 2 + dx * S + padX, y: size.h / 2 + (latToWy(lat) - view.cy) * S + padY };
  }, [view, S, size.w, size.h, padX, padY]);

  const showLabels = view.z >= 9.5;
  const flags = useMemo(() => {
    if (!size.w) return [];
    const out: { spot: Spot; x: number; y: number }[] = [];
    const cw = showLabels ? 150 : 46, ch = 46, taken = new Set<string>();
    for (const b of BEACHES) {
      if (out.length >= 90) break;
      if (view.z < 6 && !b.top) continue;
      if (sameSpot(b, spot)) continue;
      const p = project(b.lat, b.lon);
      if (p.x < padX - 10 || p.x > padX + size.w + 10 || p.y < padY - 4 || p.y > padY + size.h + 30) continue;
      const key = Math.floor(p.x / cw) + ',' + Math.floor(p.y / ch);
      if (taken.has(key)) continue;
      taken.add(key);
      out.push({ spot: b, x: p.x, y: p.y });
    }
    return out;
  }, [project, showLabels, size.w, size.h, padX, padY, spot, view.z]);

  const here = useMemo(() => (size.w ? project(spot.lat, spot.lon) : null), [project, spot, size.w]);

  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const onBackgroundTap = (x: number, y: number) => {
    const now = Date.now(), prev = lastTap.current;
    const rel = { x: x - padX - size.w / 2, y: y - padY - size.h / 2 };
    if (prev && now - prev.t < 320 && Math.hypot(x - prev.x, y - prev.y) < 40) {
      lastTap.current = null; // double tap: zoom in on that spot
      fx.tap();
      zoomStep(1, rel);
      return;
    }
    lastTap.current = { t: now, x, y };
    const wx = view.cx + rel.x / S, wy = view.cy + rel.y / S;
    if (wy < 0 || wy > 1) return;
    const lat = wyToLat(wy), lon = wxToLon(wx);
    let beach: Spot | null = null, best = Infinity;
    for (const b of BEACHES) {
      const d = Math.abs(b.lat - lat) < 1.5 ? distKm(lat, lon, b.lat, b.lon) : Infinity;
      if (d < best) { best = d; beach = b; }
    }
    fx.tap();
    setTap({ x, y, lat, lon, beach: beach && best < 60 ? beach : null, km: best });
  };

  const recenter = () => {
    fx.tap(); setTap(null);
    setView({ cx: lonToWx(spot.lon), cy: latToWy(spot.lat), z: Math.max(viewRef.current.z, 10) });
  };

  const pickCustom = (t: Tap) => {
    const ns = (lat: number) => Math.abs(lat).toFixed(2) + '°' + (lat >= 0 ? 'N' : 'S');
    const ew = (lon: number) => Math.abs(lon).toFixed(2) + '°' + (lon >= 0 ? 'E' : 'W');
    fx.flag();
    onPick({ id: 'custom', custom: true, name: 'Custom spot', region: ns(t.lat) + ', ' + ew(t.lon), lat: +t.lat.toFixed(3), lon: +t.lon.toFixed(3), facing: null });
    setTap(null);
  };

  return (
    <View ref={box} style={[{ flex: 1, backgroundColor: C.sea, overflow: 'hidden' }, Platform.OS === 'web' ? ({ touchAction: 'none' } as object) : null]} onLayout={onLayout} {...responder.panHandlers}>
      {raster ? (
        <Animated.View style={{
          position: 'absolute', left: -padX, top: -padY, width: cols * CELL, height: rows * CELL,
          transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
        }}>
          <StaticLayer r={raster} />
          <WaveLayer r={raster} run={active && !still} />
          <Pressable
            accessibilityLabel="Map. Tap the coast to pick a spot. Double tap to zoom in." style={StyleSheet.absoluteFill}
            onPress={(e) => onBackgroundTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          />
          {flags.map((f) => (
            <Flag key={f.spot.id} x={f.x} y={f.y} on={false} name={f.spot.name} label={showLabels}
              onPress={() => { fx.flag(); onPick(f.spot); }} />
          ))}
          {here ? <Flag x={here.x} y={here.y} on name={spot.name} label onPress={() => fx.tap()} /> : null}
          {tap ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: tap.x - 8, top: tap.y - 8, width: 16, height: 16, borderWidth: 3, borderColor: C.ink, backgroundColor: 'rgba(255,255,255,0.7)' }} />
          ) : null}
        </Animated.View>
      ) : null}

      <View style={{ position: 'absolute', right: 12, top: inset.top, gap: 10 }}>
        <Press label="Zoom in" onPress={() => { fx.tap(); zoomStep(1); }}><Box pad={0}><View style={zoomBtn}><T px size={16}>+</T></View></Box></Press>
        <Press label="Zoom out" onPress={() => { fx.tap(); zoomStep(-1); }}><Box pad={0}><View style={zoomBtn}><T px size={16}>-</T></View></Box></Press>
        <Press label="Back to the chosen beach" onPress={recenter}><Box pad={0} bg={C.sun}><View style={zoomBtn}><Icon name="pin" size={22} color={C.ink} /></View></Box></Press>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: inset.bottom - 4, backgroundColor: 'rgba(246,253,255,0.85)', paddingHorizontal: 5 }}>
        <T size={14} color={C.inkSoft}>Coast: Natural Earth · Beaches: USGS, OSM</T>
      </View>

      {tap ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: inset.bottom + 14, backgroundColor: C.foam, borderWidth: PX, borderColor: C.ink, padding: 10, gap: 8 }}>
          {tap.beach ? (
            <Press label={'Open ' + tap.beach.name} style={menuBtn(C.sun)} onPress={() => { fx.flag(); const b = tap.beach as Spot; setTap(null); onPick(b); }}>
              <T size={22} numberOfLines={1}>{tap.beach.name}</T>
              <T size={18} color={C.inkSoft} numberOfLines={1}>{tap.beach.region} · {Math.round(tap.km)} km away</T>
            </Press>
          ) : null}
          <Press label="Use this exact spot" style={menuBtn(C.white)} onPress={() => pickCustom(tap)}>
            <T size={22}>This exact spot</T>
            <T size={18} color={C.inkSoft}>Rated by wind and swell only</T>
          </Press>
          <Press label="Close" onPress={() => { fx.back(); setTap(null); }} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <T size={18} color={C.inkSoft}>Cancel</T>
          </Press>
        </View>
      ) : null}
    </View>
  );
});

const zoomBtn = { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' } as const;
const menuBtn = (bg: string) => ({ backgroundColor: bg, borderWidth: 3, borderColor: C.ink, paddingHorizontal: 10, paddingVertical: 8, minHeight: 52 }) as const;
