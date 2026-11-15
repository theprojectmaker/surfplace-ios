// The live pixel map: pan with one finger, pinch to zoom, tap a flag to pick a beach, or tap
// the coast to get the nearest beach (or that exact spot). The land and the moving waves are
// drawn by the app itself from the coastline data, so it works with no map service.
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { BEACHES, sameSpot } from '../data/beaches';
import { km as distKm } from '../engine/live';
import { Spot } from '../engine/types';
import { COLORS, latToWy, lonToWx, Raster, rasterize, waves, wxToLon, wyToLat } from '../map/raster';
import { fx } from '../sound';
import { C, PX } from '../theme';
import { Press, T } from './kit';

const CELL = 6;       // one map "pixel" = 6 screen points
const PAD = 0.4;      // extra map drawn around the screen, so dragging never shows a blank edge
const MIN_Z = 2, MAX_Z = 12;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (v: number) => ((v % 1) + 1) % 1;

type MapView = { cx: number; cy: number; z: number };
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

export const PixelMap = memo(function PixelMap({ spot, onPick, active }: { spot: Spot; onPick: (s: Spot) => void; active: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<MapView>(() => ({ cx: lonToWx(spot.lon), cy: latToWy(spot.lat), z: 10 }));
  const [tap, setTap] = useState<Tap | null>(null);
  const [still, setStill] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);

  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(1)).current;
  const viewRef = useRef(view);
  viewRef.current = view;
  const g = useRef({ startDist: 0, scale: 1, dx: 0, dy: 0 }).current;

  // keep the map centred on the chosen beach when it changes
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setTap(null);
    setView({ cx: lonToWx(spot.lon), cy: latToWy(spot.lat), z: Math.max(viewRef.current.z, 10) });
  }, [spot]);

  // a new view means the artwork was redrawn: drop the drag/pinch offsets in the same frame
  useLayoutEffect(() => { tx.setValue(0); ty.setValue(0); sc.setValue(1); }, [view, tx, ty, sc]);

  const finish = useCallback(() => {
    const v = viewRef.current;
    const nz = clamp(v.z + Math.log2(g.scale), MIN_Z, MAX_Z);
    const sNew = 256 * Math.pow(2, nz);
    const next = { cx: wrap(v.cx - g.dx / sNew), cy: clamp(v.cy - g.dy / sNew, 0.03, 0.97), z: nz };
    g.startDist = 0; g.scale = 1; g.dx = 0; g.dy = 0;
    setView(next);
  }, [g]);

  const responder = useMemo(() => {
    const wants = (e: { nativeEvent: { touches: unknown[] } }, s: { dx: number; dy: number }) =>
      e.nativeEvent.touches.length >= 2 || Math.abs(s.dx) > 6 || Math.abs(s.dy) > 6;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, s) => wants(e, s),
      onMoveShouldSetPanResponderCapture: (e, s) => wants(e, s),
      onPanResponderGrant: () => { g.startDist = 0; g.scale = 1; setTap(null); },
      onPanResponderMove: (e, s) => {
        const t = e.nativeEvent.touches;
        if (t.length >= 2) {
          const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
          if (!g.startDist) g.startDist = d;
          g.scale = clamp(d / g.startDist, 0.4, 3);
          sc.setValue(g.scale);
        }
        g.dx = s.dx; g.dy = s.dy;
        tx.setValue(s.dx); ty.setValue(s.dy);
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  }, [finish, g, sc, tx, ty]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: Math.round(width), h: Math.round(height) }));
  };

  const cols = Math.ceil((size.w * (1 + 2 * PAD)) / CELL), rows = Math.ceil((size.h * (1 + 2 * PAD)) / CELL);
  const padX = (cols * CELL - size.w) / 2, padY = (rows * CELL - size.h) / 2;
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
    const cw = showLabels ? 130 : 46, ch = showLabels ? 40 : 46, taken = new Set<string>();
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

  const onBackgroundTap = (x: number, y: number) => {
    const wx = view.cx + (x - padX - size.w / 2) / S, wy = view.cy + (y - padY - size.h / 2) / S;
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

  const zoomBy = (d: number) => { fx.tap(); setTap(null); setView((v) => ({ ...v, z: clamp(Math.round(v.z) + d, MIN_Z, MAX_Z) })); };

  const pickCustom = (t: Tap) => {
    const ns = (lat: number) => Math.abs(lat).toFixed(2) + '°' + (lat >= 0 ? 'N' : 'S');
    const ew = (lon: number) => Math.abs(lon).toFixed(2) + '°' + (lon >= 0 ? 'E' : 'W');
    fx.flag();
    onPick({ id: 'custom', custom: true, name: 'Custom spot', region: ns(t.lat) + ', ' + ew(t.lon), lat: +t.lat.toFixed(3), lon: +t.lon.toFixed(3), facing: null });
    setTap(null);
  };

  return (
    <View style={{ flex: 1, minHeight: 300, borderWidth: PX, borderColor: C.ink, backgroundColor: C.sea, overflow: 'hidden' }} onLayout={onLayout} {...responder.panHandlers}>
      {raster ? (
        <Animated.View style={{
          position: 'absolute', left: -padX, top: -padY, width: cols * CELL, height: rows * CELL,
          transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
        }}>
          <StaticLayer r={raster} />
          <WaveLayer r={raster} run={active && !still} />
          <Pressable
            accessibilityLabel="Map. Tap the coast to pick a spot." style={StyleSheet.absoluteFill}
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

      <View style={{ position: 'absolute', left: 8, top: 8, gap: 6 }}>
        <Press label="Zoom in" onPress={() => zoomBy(1)} style={zoomBtn}><T px size={14}>+</T></Press>
        <Press label="Zoom out" onPress={() => zoomBy(-1)} style={zoomBtn}><T px size={14}>-</T></Press>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(246,253,255,0.85)', paddingHorizontal: 5 }}>
        <T size={14} color={C.inkSoft}>Coast: Natural Earth · Beaches: USGS, OSM</T>
      </View>

      {tap ? (
        <View style={{ position: 'absolute', left: 8, right: 8, bottom: 26, backgroundColor: C.foam, borderWidth: PX, borderColor: C.ink, padding: 10, gap: 8 }}>
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

const zoomBtn = { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: C.foam, borderWidth: PX, borderColor: C.ink } as const;
const menuBtn = (bg: string) => ({ backgroundColor: bg, borderWidth: 3, borderColor: C.ink, paddingHorizontal: 10, paddingVertical: 8, minHeight: 52 }) as const;
