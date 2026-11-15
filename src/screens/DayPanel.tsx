// One day, opened up: hour-by-hour wave bars, the tide curve and a read-out for the chosen hour.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { ForecastData, Rating, Win } from '../engine/forecast';
import { buildDay, hourDetail } from '../engine/report';
import { Units } from '../engine/types';
import { fx } from '../sound';
import { C, CLS, PX } from '../theme';
import { Box, T } from '../ui/kit';

const LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];

export function DayPanel({ data, rated, wins, d, units }: { data: ForecastData; rated: (Rating | null)[]; wins: (Win | null)[]; d: number; units: Units }) {
  const day = React.useMemo(() => buildDay(data, rated, wins, d), [data, rated, wins, d]);
  const [sel, setSel] = useState(day.defaultHour);
  const read = hourDetail(data, rated, sel, units);
  const start = d * 24;
  const selX = (sel - start) / 23;

  return (
    <Box pad={6} style={{ marginTop: 10 }}>
      <T px size={8} color={C.inkSoft} style={{ marginBottom: 8 }}>WAVE SIZE BY HOUR</T>
      <View style={{ flexDirection: 'row', height: 130, gap: 1, alignItems: 'flex-end', borderBottomWidth: 3, borderColor: C.ink, paddingHorizontal: 2 }}>
        {day.bars.map((b) => (
          <Pressable
            key={b.i} accessibilityRole="button" accessibilityLabel={b.label}
            onPress={() => { fx.tap(); setSel(b.i); }}
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end', backgroundColor: b.i === sel ? 'rgba(11,37,69,0.14)' : 'transparent' }}
          >
            <View style={{
              height: Math.max(4, Math.round((b.ft / day.maxFt) * 126)), backgroundColor: CLS[b.cls],
              borderWidth: 1, borderBottomWidth: 0, borderColor: C.ink, opacity: b.light ? 1 : 0.3,
            }} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, paddingTop: 3 }}>
        {LABELS.map((l) => <T key={l} size={17} color={C.inkSoft}>{l}</T>)}
      </View>

      {day.tide ? (
        <View style={{ marginTop: 14 }}>
          <T px size={8} color={C.inkSoft} style={{ marginBottom: 6 }}>TIDE {day.tide.real ? '' : '(ESTIMATED)'}</T>
          <View style={{ height: 70, borderWidth: 3, borderColor: C.ink, backgroundColor: C.white }}>
            <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
              <Path
                fill={C.seaLight} stroke={C.ink} strokeWidth={0.9}
                d={day.tide.pts.map((p, i) => (i ? 'L' : 'M') + (p.x * 100).toFixed(1) + ' ' + (36 - p.y * 30).toFixed(1)).join('') + 'L100 40L0 40Z'}
              />
              <Rect x={selX * 100 - 0.6} y={0} width={1.2} height={40} fill={C.coral} />
            </Svg>
          </View>
          <T size={20} color={C.inkSoft} style={{ marginTop: 4 }}>
            {day.tide.marks.length
              ? day.tide.marks.map((m) => (m.type === 'high' ? 'High ' : 'Low ') + m.label).join('  ·  ')
              : 'No high or low tide today'}
          </T>
        </View>
      ) : null}

      <View style={{ marginTop: 14, minHeight: 64, backgroundColor: C.cream, borderWidth: 3, borderColor: C.ink, padding: 10 }}>
        <T px size={9}>{read.title}</T>
        {read.lines.map((l, i) => <T key={i} size={22} style={{ marginTop: 4 }}>{l}</T>)}
      </View>
      <T size={19} color={C.inkSoft} style={{ marginTop: 6 }}>
        Tap a bar. Taller = bigger waves, colour = how good, faded = dark outside.
      </T>
    </Box>
  );
}
