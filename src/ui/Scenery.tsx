// The app's backdrop and header: pixel water that drifts sideways, a banner with a sun, a cloud
// and rolling waves. Both animate on the native thread, so they cost almost nothing.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { C, F, PX } from '../theme';
import { Icon, T } from './kit';

function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  return still;
}

// slides something sideways by exactly one repeat of its pattern, forever (so it looks endless)
function useDrift(distance: number, ms: number, run = true) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) return;
    const loop = Animated.loop(Animated.timing(x, { toValue: -distance, duration: ms, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x, distance, ms, run]);
  return x;
}

const TILE_W = 96, TILE_H = 72;
export function WaterBg() {
  const width = Math.min(useWindowDimensions().width, 480);
  const still = useStill();
  const x = useDrift(TILE_W, 16000, !still);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: width + TILE_W, transform: [{ translateX: x }] }}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="water" width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse">
              <Rect width={TILE_W} height={TILE_H} fill="#bfeefa" />
              <Path fill="#ffffff" opacity={0.75} d="M8 10h20v4H8zM28 14h8v4h-8zM60 46h24v4H60zM52 50h8v4h-8z" />
              <Path fill="#9fe0f4" d="M62 18h16v4H62zM12 54h20v4H12zM44 30h8v4h-8z" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#water)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const SKY = ['#55c3f3', '#7ad3f8', '#a0e1fc', '#c6effe'];
const SEA_H = 22;
function Logo() {
  return (
    <View style={{ width: 48, height: 48, backgroundColor: C.sun, borderWidth: PX, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="wave" size={34} color={C.seaDeep} />
    </View>
  );
}

export function Banner({ top }: { top: number }) {
  const still = useStill();
  const sea = useDrift(40, 2400, !still);
  const cloud = useRef(new Animated.Value(0)).current;
  const width = Math.min(useWindowDimensions().width, 480);
  useEffect(() => {
    if (still) return;
    const a = Animated.loop(Animated.timing(cloud, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [cloud, still]);
  const H = top + 90;
  return (
    <View style={{ height: H, backgroundColor: SKY[0], borderBottomWidth: PX, borderColor: C.ink, overflow: 'hidden' }}>
      {SKY.map((c, i) => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: (i * (H - SEA_H)) / 4, height: (H - SEA_H) / 4 + 1, backgroundColor: c }} />)}
      {/* sun */}
      <View style={{ position: 'absolute', right: 30, top: top + 12, width: 36, height: 36, backgroundColor: C.sun }} />
      <View style={{ position: 'absolute', right: 22, top: top + 20, width: 52, height: 20, backgroundColor: C.sun }} />
      <View style={{ position: 'absolute', right: 38, top: top + 4, width: 20, height: 52, backgroundColor: C.sun }} />
      {/* a cloud drifting across */}
      <Animated.View style={{ position: 'absolute', top: top + 10, left: 0, transform: [{ translateX: cloud.interpolate({ inputRange: [0, 1], outputRange: [-80, width] }) }] }}>
        <View style={{ width: 56, height: 12, backgroundColor: '#fff', marginTop: 12 }} />
        <View style={{ position: 'absolute', left: 12, top: 4, width: 32, height: 12, backgroundColor: '#fff' }} />
        <View style={{ position: 'absolute', left: 4, top: 8, width: 48, height: 12, backgroundColor: '#fff' }} />
      </Animated.View>
      {/* title */}
      <View style={{ position: 'absolute', left: 14, right: 14, top: top + 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Logo />
        <View style={{ flex: 1 }}>
          <T px size={19} color={C.white} style={{ textShadowColor: C.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 }}>SURFPLACE</T>
          <T fit size={17} color={C.ink} style={{ marginTop: 3 }}>All the surf knowledge you need in one app</T>
        </View>
      </View>
      {/* rolling sea along the bottom edge */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: SEA_H, backgroundColor: C.sea, borderTopWidth: PX, borderColor: C.ink, overflow: 'hidden' }}>
        <Animated.View style={{ width: width + 40, height: SEA_H, transform: [{ translateX: sea }] }}>
          <Svg width="100%" height="100%">
            <Defs>
              <Pattern id="swell" width={40} height={SEA_H} patternUnits="userSpaceOnUse">
                <Path fill="#ffffff" d="M2 4h12v4H2zM6 8h8v4H6zM24 12h10v4H24zM20 16h8v4H20z" />
                <Path fill={C.seaLight} d="M18 2h8v4h-8zM30 6h8v4h-8zM0 14h8v4H0z" />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#swell)" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

export const FONT_NAMES = F;
