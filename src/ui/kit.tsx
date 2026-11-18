// Pixel-styled building blocks used by every screen.
// The signature look: boxes with notched (stair-step) corners, a hard offset shadow, chunky ink
// borders, tiny pixel icons.
import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { C, F, PX } from '../theme';

type TProps = { px?: boolean; size?: number; color?: string; style?: StyleProp<TextStyle>; children?: React.ReactNode; numberOfLines?: number; fit?: boolean };
// px = the chunky "Press Start" headline font, otherwise the readable VT323 body font
export function T({ px, size, color = C.ink, style, children, numberOfLines, fit }: TProps) {
  const s = size ?? (px ? 10 : 22);
  return (
    <Text
      numberOfLines={fit ? 1 : numberOfLines}
      adjustsFontSizeToFit={fit}
      minimumFontScale={0.7}
      allowFontScaling={false}
      style={[{ fontFamily: px ? F.px : F.body, fontSize: s, color, lineHeight: Math.round(s * (px ? 1.5 : 1.12)) }, style]}
    >
      {children}
    </Text>
  );
}

// A box with notched pixel corners. `style` is for placement (margins, flex); `pad` is inside.
export function Box({ children, bg = C.foam, border = C.ink, pad = 12, shadow = true, style }: {
  children?: React.ReactNode; bg?: string; border?: string; pad?: number; shadow?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ position: 'relative' }, style]}>
      {shadow ? <View pointerEvents="none" style={{ position: 'absolute', left: 3, right: -3, top: 4, bottom: -4, backgroundColor: 'rgba(11,37,69,0.24)' }} /> : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: PX, right: PX, top: 0, bottom: 0, backgroundColor: bg, borderTopWidth: PX, borderBottomWidth: PX, borderColor: border }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: PX, bottom: PX, left: 0, right: 0, backgroundColor: bg, borderLeftWidth: PX, borderRightWidth: PX, borderColor: border }} />
      <View style={{ padding: pad + PX }}>{children}</View>
    </View>
  );
}

// a card whose content manages its own padding
export function Card({ children, style, bg = C.foam, pad = 0 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; bg?: string; pad?: number }) {
  return <Box bg={bg} pad={pad} style={style}>{children}</Box>;
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

// the standard chunky button
export function PButton({ label, onPress, bg = C.sun, color = C.ink, size = 10, pad = 10, style, a11y }: {
  label: string; onPress: () => void; bg?: string; color?: string; size?: number; pad?: number; style?: StyleProp<ViewStyle>; a11y?: string;
}) {
  return (
    <Press onPress={onPress} label={a11y || label} style={style}>
      <Box bg={bg} pad={pad}><T px size={size} color={color} style={{ textAlign: 'center' }}>{label}</T></Box>
    </Press>
  );
}

// ---------- tiny 8x8 pixel icons ----------
const GLYPHS: Record<string, string[]> = {
  wave: ['........', '........', '.##..##.', '#..##..#', '........', '.##..##.', '#..##..#', '........'],
  bars: ['........', '......##', '......##', '....####', '....####', '..######', '..######', '########'],
  wind: ['........', '.######.', '.......#', '.######.', '........', '.####...', '.....#..', '.####...'],
  tide: ['...##...', '..####..', '.######.', '........', '........', '.######.', '..####..', '...##...'],
  drop: ['...#....', '...#....', '..###...', '.#####..', '.#####..', '.#####..', '..###...', '........'],
  cloud: ['........', '...##...', '..####..', '.######.', '########', '########', '.######.', '........'],
  sun: ['...#....', '.#.#.#..', '..###...', '###.###.', '..###...', '.#.#.#..', '...#....', '........'],
  moon: ['..###...', '.##.....', '##......', '##......', '##......', '.##.....', '..###...', '........'],
  board: ['......##', '.....###', '....###.', '...###..', '..###...', '.###....', '###.....', '##......'],
  flag: ['.#......', '.####...', '.#####..', '.####...', '.#......', '.#......', '.#......', '.#......'],
  star: ['...##...', '..####..', '########', '.######.', '..####..', '.##..##.', '.#....#.', '........'],
  pin: ['..####..', '.######.', '.##..##.', '.##..##.', '.######.', '..####..', '...##...', '...#....'],
  log: ['.######.', '.#....#.', '.#.##.#.', '.#....#.', '.#.##.#.', '.#....#.', '.#.##.#.', '.######.'],
  check: ['.......#', '......##', '#....##.', '##..##..', '.####...', '..##....', '........', '........'],
};
export function Icon({ name, size = 24, color = C.ink }: { name: keyof typeof GLYPHS | string; size?: number; color?: string }) {
  const cells = useMemo(() => {
    const out: React.ReactNode[] = [];
    (GLYPHS[name] || GLYPHS.wave).forEach((row, y) => {
      for (let x = 0; x < 8; x++) if (row[x] === '#') out.push(<Rect key={x + ',' + y} x={x} y={y} width={1.04} height={1.04} fill={color} />);
    });
    return out;
  }, [name, color]);
  return <Svg width={size} height={size} viewBox="0 0 8 8">{cells}</Svg>;
}

// an icon sitting in a little coloured tile
export function IconTile({ name, bg = C.seaLight, size = 40 }: { name: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, backgroundColor: bg, borderWidth: 3, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size - 16} />
    </View>
  );
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 }, style]}>
      <Icon name="wave" size={22} color={C.seaDeep} />
      <T px size={12}>{children}</T>
      <View style={{ flex: 1, height: 4, borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.seaDeep, opacity: 0.5, marginTop: 4 }} />
    </View>
  );
}

export function Chip({ label, color, style }: { label: string; color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Box bg={color} pad={5} shadow={false} style={style}>
      <T px size={9} color={color === C.epic ? C.white : C.ink} style={{ textAlign: 'center' }}>{label}</T>
    </Box>
  );
}

export function Seg<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(it.key)} style={{ flex: 1 }}>
            <Box bg={on ? C.sun : C.white} pad={8} shadow={on} style={{ minHeight: 50 }}>
              <View style={{ minHeight: 28, alignItems: 'center', justifyContent: 'center' }}>
                <T px size={9} style={{ textAlign: 'center' }}>{it.label}</T>
              </View>
            </Box>
          </Pressable>
        );
      })}
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
        <View key={i} style={{ flex: 1, height: 14, borderWidth: 2, borderColor: C.ink, backgroundColor: i < on ? color : 'rgba(255,255,255,0.55)' }} />
      ))}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 2, backgroundColor: C.line }} />;
}
