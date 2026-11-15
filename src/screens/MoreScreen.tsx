import React, { useState } from 'react';
import { LayoutAnimation, Linking, ScrollView, View } from 'react-native';
import { fx } from '../sound';
import { useStore } from '../store';
import { C } from '../theme';
import { Card, Heading, Press, Seg, T } from '../ui/kit';

type Topic = [string, string, string, string[]]; // group, title, intro, lines
const topics = require('../data/knowledge.json') as Topic[];
const version = (require('../../app.json') as { expo: { version: string } }).expo.version;

const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
const ONOFF = [{ key: 'on' as const, label: 'ON' }, { key: 'off' as const, label: 'OFF' }];

const SOURCES: [string, string][] = [
  ['Wave and weather forecasts', 'Open-Meteo.com (CC BY 4.0), using ECMWF, NOAA GFS-Wave and Meteo-France wave models'],
  ['Live buoys and tides', 'NOAA National Data Buoy Center and NOAA CO-OPS tide predictions (US government, public domain)'],
  ['Beaches', 'USGS Geographic Names Information System (public domain) and OpenStreetMap contributors (ODbL)'],
  ['Coastline', 'Natural Earth (public domain)'],
];

export function MoreScreen() {
  const s = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const groups: { name: string; items: Topic[] }[] = [];
  topics.forEach((t) => {
    let g = groups.find((x) => x.name === t[0]);
    if (!g) { g = { name: t[0], items: [] }; groups.push(g); }
    g.items.push(t);
  });
  const flip = (k: 'sound' | 'ocean' | 'haptics', v: 'on' | 'off') => {
    const on = v === 'on';
    if (!on) fx.toggle();
    s.set(k, on);
    if (on) setTimeout(fx.toggle, 30);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      <Heading style={{ marginTop: 4 }}>SETTINGS</Heading>
      <Card style={{ padding: 14, gap: 6 }}>
        <T px size={8} color={C.inkSoft}>MY LEVEL</T>
        <Seg value={s.skill} onChange={(k) => { fx.select(); s.set('skill', k); }}
          items={[{ key: 'beginner', label: 'BEGINNER' }, { key: 'intermediate', label: 'MIDDLE' }, { key: 'advanced', label: 'EXPERT' }]} />
        <T size={19} color={C.inkSoft} style={{ marginBottom: 8 }}>Changes what counts as a good wave, and when waves are too big.</T>

        <T px size={8} color={C.inkSoft}>UNITS</T>
        <Seg value={s.units} onChange={(k) => { fx.select(); s.set('units', k); }}
          items={[{ key: 'us', label: 'FEET / °F' }, { key: 'metric', label: 'METERS / °C' }]} />

        <T px size={8} color={C.inkSoft} style={{ marginTop: 12 }}>SOUND EFFECTS</T>
        <Seg value={s.sound ? 'on' : 'off'} onChange={(v) => flip('sound', v)} items={ONOFF} />
        <T px size={8} color={C.inkSoft} style={{ marginTop: 12 }}>OCEAN SOUND</T>
        <Seg value={s.ocean ? 'on' : 'off'} onChange={(v) => flip('ocean', v)} items={ONOFF} />
        <T px size={8} color={C.inkSoft} style={{ marginTop: 12 }}>VIBRATION</T>
        <Seg value={s.haptics ? 'on' : 'off'} onChange={(v) => flip('haptics', v)} items={ONOFF} />
        <T size={19} color={C.inkSoft} style={{ marginTop: 6 }}>Sounds follow your phone's silent switch.</T>
      </Card>

      <Heading>SURF KNOWLEDGE</Heading>
      {groups.map((g) => (
        <View key={g.name}>
          <T px size={9} color={C.inkSoft} style={{ marginTop: 14, marginBottom: 8 }}>{g.name}</T>
          {g.items.map((t) => {
            const isOpen = open === t[1];
            return (
              <Card key={t[1]} style={{ marginBottom: 8 }}>
                <Press label={t[1]} onPress={() => { fx.tap(); ease(); setOpen(isOpen ? null : t[1]); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14, minHeight: 56 }}>
                  <T px size={10} color={C.seaDeep} style={{ flex: 1 }}>{t[1]}</T>
                  <T px size={14}>{isOpen ? '-' : '+'}</T>
                </Press>
                {isOpen ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                    {t[2] ? <T size={23} style={{ marginBottom: 6 }}>{t[2]}</T> : null}
                    {t[3].map((line, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 5 }}>
                        <T size={23}>{'•'}</T>
                        <T size={23} style={{ flex: 1 }}>{line}</T>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      ))}

      <Heading>ABOUT</Heading>
      <Card style={{ padding: 14 }}>
        <T px size={11}>SURFPLACE {version}</T>
        <T size={22} color={C.inkSoft} style={{ marginTop: 6 }}>All the surf knowledge you need in one app.</T>
        <T size={22} style={{ marginTop: 10 }}>
          Forecasts are predictions, not a promise. The next 3 days are the most reliable. Always look at the water and know your limits before paddling out.
        </T>
        <T px size={8} color={C.seaDeep} style={{ marginTop: 14, marginBottom: 6 }}>WHERE THE DATA COMES FROM</T>
        {SOURCES.map(([k, v]) => (
          <View key={k} style={{ marginBottom: 8 }}>
            <T size={22}>{k}</T>
            <T size={19} color={C.inkSoft}>{v}</T>
          </View>
        ))}
        <Press label="Open Open-Meteo website" onPress={() => { fx.tap(); void Linking.openURL('https://open-meteo.com/'); }}>
          <T size={21} color={C.seaDeep} style={{ textDecorationLine: 'underline' }}>open-meteo.com</T>
        </Press>
        <T size={18} color={C.inkSoft} style={{ marginTop: 10 }}>
          Your location is only used when you tap NEAR ME, and it never leaves your phone.
        </T>
      </Card>
    </ScrollView>
  );
}
