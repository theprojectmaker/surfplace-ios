// SurfPlace: a native iPhone app. Every screen is made of real iOS views (no web page inside).
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Animated, InteractionManager, Platform, Pressable, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildCoast } from './src/map/coast';
import { BeachesScreen } from './src/screens/BeachesScreen';
import { ForecastScreen } from './src/screens/ForecastScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { fx, warmUp } from './src/sound';
import { StoreProvider, Tab, useStore } from './src/store';
import { C, F, PX } from './src/theme';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { Icon, T } from './src/ui/kit';
import { WaterBg } from './src/ui/Scenery';
import { TopBar } from './src/ui/TopBar';
import { setupWeb } from './src/web';

void SplashScreen.preventAutoHideAsync().catch(() => {});
setupWeb();

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'forecast', label: 'FORECAST', icon: 'wave' },
  { key: 'map', label: 'BEACHES', icon: 'pin' },
  { key: 'more', label: 'MORE', icon: 'star' },
];

// one screen. It stays alive when hidden, so switching is instant and the map keeps its place.
function Pane({ active, children }: { active: boolean; children: React.ReactNode }) {
  const o = useRef(new Animated.Value(1)).current;
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current) { o.setValue(0.2); Animated.timing(o, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }
    was.current = active;
  }, [active, o]);
  return <Animated.View style={{ flex: 1, opacity: o, display: active ? 'flex' : 'none' }}>{children}</Animated.View>;
}

function TabBar({ bottom }: { bottom: number }) {
  const s = useStore();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.ink, borderTopWidth: PX, borderColor: C.ink }}>
      {TABS.map((t, i) => {
        const on = s.tab === t.key;
        return (
          <Pressable
            key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
            onPress={() => { if (!on) { fx.tap(); s.go(t.key); } }}
            style={({ pressed }) => ({
              flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
              // the button runs all the way to the screen edge; its content sits above the home indicator
              paddingTop: 10, paddingBottom: Math.max(bottom, 10) + 4,
              backgroundColor: on ? C.sun : pressed ? '#dff4fb' : C.foam,
              borderLeftWidth: i ? PX : 0, borderColor: C.ink,
            })}
          >
            <Icon name={t.icon} size={26} color={on ? C.ink : C.seaDeep} />
            <T px size={8} color={C.ink}>{t.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Shell() {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const seenMap = useRef(false);
  if (s.tab === 'map') seenMap.current = true;
  useEffect(() => {
    warmUp();
    // decode the world coastline in a quiet moment, so the first visit to the map is quick
    const h = InteractionManager.runAfterInteractions(() => { setTimeout(() => { try { buildCoast(); } catch { /* built on demand instead */ } }, 2000); });
    return () => h.cancel();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.aqua }}>
      <StatusBar style="dark" />
      <WaterBg />
      <TopBar top={insets.top} />
      <View style={{ flex: 1 }}>
        <Pane active={s.tab === 'forecast'}><ErrorBoundary name="forecast"><ForecastScreen /></ErrorBoundary></Pane>
        {seenMap.current ? <Pane active={s.tab === 'map'}><ErrorBoundary name="beaches"><BeachesScreen /></ErrorBoundary></Pane> : null}
        <Pane active={s.tab === 'more'}><ErrorBoundary name="more"><MoreScreen /></ErrorBoundary></Pane>
      </View>
      <TabBar bottom={insets.bottom} />
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

// in a web browser the app is shown as a phone-width column, centred on a dark page
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: C.aqua, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

export default function App() {
  return (
    <WebFrame>
      <SafeAreaProvider>
        <ErrorBoundary name="app">
          <StoreProvider>
            <Gate />
          </StoreProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </WebFrame>
  );
}
