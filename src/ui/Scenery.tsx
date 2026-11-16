// The app's backdrop (pixel water that drifts sideways) and a calm, simple top bar.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { C, PX } from '../theme';
import { Icon, T } from './kit';

function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  return still;
}

const TILE_W = 96, TILE_H = 72;
export function WaterBg() {
  const width = Math.min(useWindowDimensions().width, 480);
  const still = useStill();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(x, { toValue: -TILE_W, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x, still]);
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

// logo, name and motto on a plain blue bar: nothing moving, nothing busy
export function Banner({ top }: { top: number }) {
  return (
    <View style={{ backgroundColor: C.sea, paddingTop: top + 8, paddingBottom: 10, paddingHorizontal: 14, borderBottomWidth: PX, borderColor: C.ink }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, backgroundColor: C.sun, borderWidth: 3, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="wave" size={30} color={C.seaDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <T px size={17} color={C.white} style={{ textShadowColor: C.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>SURFPLACE</T>
          <T fit size={16} color="#eaf8ff" style={{ marginTop: 2 }}>All the surf knowledge you need in one app</T>
        </View>
      </View>
    </View>
  );
}
