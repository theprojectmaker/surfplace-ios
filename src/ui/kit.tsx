// Small pixel-styled building blocks used by every screen.
import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C, F, PX } from '../theme';

type TProps = { px?: boolean; size?: number; color?: string; style?: StyleProp<TextStyle>; children?: React.ReactNode; numberOfLines?: number };
// px = the chunky "Press Start" headline font, otherwise the readable VT323 body font
export function T({ px, size, color = C.ink, style, children, numberOfLines }: TProps) {
  const s = size ?? (px ? 10 : 22);
  return (
    <Text
      numberOfLines={numberOfLines}
      allowFontScaling={false}
      style={[{ fontFamily: px ? F.px : F.body, fontSize: s, color, lineHeight: Math.round(s * (px ? 1.5 : 1.12)) }, style]}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style, bg = C.foam }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; bg?: string }) {
  return (
    <View style={[{
      backgroundColor: bg, borderWidth: PX, borderColor: C.ink,
      shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 0, elevation: 3,
    }, style]}>
      {children}
    </View>
  );
}

// a button that squishes a little when pressed
export function Press({ onPress, children, style, label, disabled, hitSlop }: {
  onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; label?: string; disabled?: boolean; hitSlop?: number;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} disabled={disabled} hitSlop={hitSlop}
      onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <T px size={12} style={[{ marginTop: 26, marginBottom: 10 }, style]}>{children}</T>;
}

export function Chip({ label, color, style }: { label: string; color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: color, borderWidth: 3, borderColor: C.ink, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center' }, style]}>
      <T px size={9} color={color === C.epic ? C.white : C.ink}>{label}</T>
    </View>
  );
}

export function Seg<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.ink, borderWidth: PX, borderColor: C.ink, gap: PX }}>
      {items.map((it) => (
        <Pressable
          key={it.key} accessibilityRole="button" accessibilityState={{ selected: it.key === value }}
          onPress={() => onChange(it.key)}
          style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, backgroundColor: it.key === value ? C.sun : C.white }}
        >
          <T px size={8}>{it.label}</T>
        </Pressable>
      ))}
    </View>
  );
}

// the direction something is travelling, as a little pixel arrow (from = where it comes FROM)
export function Arrow({ from, size = 16, color = C.ink }: { from: number; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, transform: [{ rotate: ((from + 180) % 360) + 'deg' }] }}>
      <Svg width={size} height={size} viewBox="0 0 8 8">
        <Path fill={color} d="M3 8V4H1V3h1V2h1V1h1V0h1v1h1v1h1v1h1v1H5v4z" />
      </Svg>
    </View>
  );
}

// ten pixel blocks showing a 0-100 score
export function Meter({ score, color }: { score: number; color: string }) {
  const on = Math.round(Math.max(0, Math.min(100, score)) / 10);
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 12, borderWidth: 2, borderColor: C.ink, backgroundColor: i < on ? color : 'rgba(255,255,255,0.55)' }} />
      ))}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 2, backgroundColor: C.line }} />;
}
