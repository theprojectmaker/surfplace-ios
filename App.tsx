// SurfPlace: a native iPhone app. Every screen is made of real iOS views (no web page inside).
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { buildCoast } from './src/map/coast';
import { BeachesScreen } from './src/screens/BeachesScreen';
import { ForecastScreen } from './src/screens/ForecastScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { fx, warmUp } from './src/sound';
import { StoreProvider, Tab, useStore } from './src/store';
import { C, F, PX } from './src/theme';
import { Press, T } from './src/ui/kit';

void SplashScreen.preventAutoHideAsync().catch(() => {});

// the 16x16 pixel wave from the app icon
const LOGO = [
  '................', '................', '.....wwww.......', '...wwbbbbww.....',
  '..wbbbbbbbbw....', '.wbbbddddbbbw...', '.wbbd....dbbw...', 'wbbd......dbw...',
  'wbbd.......ww...', 'wbbbd...........', 'wbbbbd..........', 'wbbbbbdd......ww',
  'bbbbbbbbddddwwbb', 'bbbbbbbbbbbbbbbb', 'dbbbbbbbbbbbbbbd', 'dddddddddddddddd',
];
const LOGO_COL: Record<string, string> = { w: '#ffffff', b: C.sea, d: C.seaDeep };
function Logo() {
  return (
    <View style={{ width: 48, height: 48, backgroundColor: C.sun, borderWidth: PX, borderColor: C.ink }}>
      <Svg width="100%" height="100%" viewBox="0 0 16 16">
        {LOGO.flatMap((row, y) => row.split('').map((ch, x) => (LOGO_COL[ch] ? <Rect key={x + ',' + y} x={x} y={y} width={1.02} height={1.02} fill={LOGO_COL[ch]} /> : null)))}
      </Svg>
    </View>
  );
}

function TabIcon({ kind }: { kind: Tab }) {
  if (kind === 'forecast') {
    return (
      <View style={{ width: 20, height: 16 }}>
        <View style={{ position: 'absolute', left: 0, top: 12, width: 20, height: 4, backgroundColor: C.sea }} />
        <View style={{ position: 'absolute', left: 0, top: 8, width: 12, height: 4, backgroundColor: C.sea }} />
        <View style={{ position: 'absolute', left: 4, top: 4, width: 8, height: 4, backgroundColor: C.sea }} />
        <View style={{ position: 'absolute', left: 8, top: 0, width: 8, height: 4, backgroundColor: C.sea }} />
      </View>
    );
  }
  if (kind === 'map') {
    return (
      <View style={{ width: 20, height: 16 }}>
        <View style={{ position: 'absolute', left: 4, top: 0, width: 4, height: 16, backgroundColor: C.ink }} />
        <View style={{ position: 'absolute', left: 8, top: 0, width: 10, height: 8, backgroundColor: C.coral }} />
      </View>
    );
  }
  return (
    <View style={{ width: 20, height: 16, justifyContent: 'space-between' }}>
      {[0, 1, 2].map((i) => <View key={i} style={{ height: 4, backgroundColor: C.ink }} />)}
    </View>
  );
}

const TABS: { key: Tab; label: string }[] = [{ key: 'forecast', label: 'FORECAST' }, { key: 'map', label: 'BEACHES' }, { key: 'more', label: 'MORE' }];

function Shell() {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const [seenMap, setSeenMap] = useState(false);
  useEffect(() => { if (s.tab === 'map') setSeenMap(true); }, [s.tab]);
  useEffect(() => {
    warmUp();
    // decode the world coastline in a quiet moment, so the first visit to the map is instant
    const h = InteractionManager.runAfterInteractions(() => { setTimeout(() => { try { buildCoast(); } catch { /* built on demand instead */ } }, 2500); });
    return () => h.cancel();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.ink }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: C.aqua }}>
        <View style={{ paddingTop: insets.top + 10, paddingBottom: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.sea, borderBottomWidth: PX, borderColor: C.ink }}>
          <Logo />
          <View style={{ flex: 1 }}>
            <T px size={18} color={C.white} style={{ textShadowColor: C.ink, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 }}>SURFPLACE</T>
            <T size={19} color="#eafaff" style={{ marginTop: 3 }}>All the surf knowledge you need in one app</T>
          </View>
        </View>

        {/* all three screens stay alive so switching is instant and the map keeps its place */}
        <View style={{ flex: 1, display: s.tab === 'forecast' ? 'flex' : 'none' }}><ForecastScreen /></View>
        {seenMap ? <View style={{ flex: 1, display: s.tab === 'map' ? 'flex' : 'none' }}><BeachesScreen /></View> : null}
        <View style={{ flex: 1, display: s.tab === 'more' ? 'flex' : 'none' }}><MoreScreen /></View>
      </View>

      <View style={{ flexDirection: 'row', gap: PX, backgroundColor: C.ink, paddingBottom: insets.bottom, borderTopWidth: PX, borderColor: C.ink }}>
        {TABS.map((t) => (
          <View key={t.key} style={{ flex: 1 }}>
            <Press label={t.label} onPress={() => { if (s.tab !== t.key) { fx.tap(); s.go(t.key); } }}
              style={{ height: 68, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: s.tab === t.key ? C.sun : C.foam }}>
              <TabIcon kind={t.key} />
              <T px size={8}>{t.label}</T>
            </Press>
          </View>
        ))}
      </View>
    </View>
  );
}

function Gate() {
  const s = useStore();
  const [fontsLoaded] = useFonts({ [F.px]: PressStart2P_400Regular, [F.body]: VT323_400Regular });
  const ready = fontsLoaded && s.ready;
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.sea }} />;
  return <Shell />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
