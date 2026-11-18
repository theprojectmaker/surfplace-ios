// Extra widgets for the premium forecast + journal: a swell compass, star rating, and stat tiles.
import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { SwellTrain } from '../engine/detail';
import { C, CLS } from '../theme';
import { Box, Icon, T } from './kit';

// A compass showing where each swell train comes from and which way this beach faces.
// Arrows point the way the swell travels (toward shore); length and colour show its strength.
export function SwellCompass({ trains, facing, size = 150 }: { trains: SwellTrain[]; facing: number | null; size?: number }) {
  const c = size / 2, R = c - 18;
  const ink = C.ink;
  const arrow = (fromDeg: number, len: number, color: string, w: number) => {
    // travels toward (fromDeg + 180); draw from the rim inward
    const to = ((fromDeg + 180) % 360) * Math.PI / 180;
    const sx = c - R * Math.sin(to - Math.PI), sy = c + R * Math.cos(to - Math.PI);
    const ex = c - (R - len) * Math.sin(to), ey = c + (R - len) * Math.cos(to);
    return (
      <G key={fromDeg + color}>
        <Line x1={c + R * Math.sin(to - Math.PI)} y1={c - R * Math.cos(to - Math.PI)}
          x2={c - (R * 0.15) * Math.sin(to)} y2={c + (R * 0.15) * Math.cos(to)} stroke={color} strokeWidth={w} />
        <Circle cx={c - (R * 0.15) * Math.sin(to)} cy={c + (R * 0.15) * Math.cos(to)} r={w + 1.5} fill={color} />
      </G>
    );
  };
  const maxE = Math.max(...trains.map((t) => t.heightM * t.period), 0.1);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
        <Circle cx={c} cy={c} r={R} fill={C.aqua} stroke={ink} strokeWidth={3} />
        <Circle cx={c} cy={c} r={R * 0.55} fill="none" stroke={ink} strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
        {/* the beach shoreline marker */}
        {facing !== null ? (() => {
          const a = (facing * Math.PI) / 180;
          return <Line x1={c + R * Math.sin(a)} y1={c - R * Math.cos(a)} x2={c} y2={c} stroke="#d99f3c" strokeWidth={6} opacity={0.9} />;
        })() : null}
        {trains.map((t) => arrow(t.dir, R * 0.82 * (0.45 + 0.55 * Math.min(1, (t.heightM * t.period) / maxE)),
          t.kind === 'primary' ? C.seaDeep : t.kind === 'secondary' ? C.epic : C.flat, t.main ? 4 : 3))}
        <Circle cx={c} cy={c} r={4} fill={ink} />
        {['N', 'E', 'S', 'W'].map((d, i) => {
          const a = (i * 90 * Math.PI) / 180;
          return <SvgText key={d} x={c + (R + 9) * Math.sin(a)} y={c - (R + 9) * Math.cos(a) + 4} fontSize={11} fontFamily="PressStart" fill={ink} textAnchor="middle">{d}</SvgText>;
        })}
      </Svg>
    </View>
  );
}

// 1..5 stars, tappable when onChange is given
export function Stars({ value, size = 22, onChange, color = C.sun }: { value: number; size?: number; onChange?: (v: number) => void; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Icon name="star" size={size} color={n <= value ? color : '#cfe3ee'} />;
        return onChange ? (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={n + ' stars'} hitSlop={6} onPress={() => onChange(n)} style={{ padding: 2 }}>{star}</Pressable>
        ) : <View key={n}>{star}</View>;
      })}
    </View>
  );
}

// a labelled number tile for the journal stats row
export function StatTile({ label, value, sub, bg = C.foam }: { label: string; value: string; sub?: string; bg?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Box bg={bg} pad={2}>
        <View style={{ alignItems: 'center', paddingVertical: 10, minHeight: 72, justifyContent: 'center' }}>
          <T px size={16}>{value}</T>
          <T px size={7} color={C.inkSoft} style={{ marginTop: 6, textAlign: 'center' }}>{label}</T>
          {sub ? <T size={16} color={C.inkSoft} style={{ marginTop: 2 }}>{sub}</T> : null}
        </View>
      </Box>
    </View>
  );
}

export { CLS };
