import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Linking, RefreshControl, ScrollView, View, LayoutAnimation } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { BEACHES, sameSpot } from '../data/beaches';
import { Cls } from '../engine/forecast';
import { CHIP, dist, rangeShort, hourLabel, sizeText, ago } from '../engine/format';
import { loadNearby, NearbySpot } from '../engine/nearby';
import { buildReport } from '../engine/report';
import { fx } from '../sound';
import { useStore } from '../store';
import { C, CLS, CLS_SOFT, PX } from '../theme';
import { Arrow, Card, Chip, Divider, Heading, Meter, Press, T } from '../ui/kit';
import { PixelScene } from '../ui/PixelScene';
import { DayPanel } from './DayPanel';
import { keyOf, useForecast } from './useForecast';

const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));

// pixel star for the "save this beach" button: filled when saved, with a dark outline
const STAR = ['....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.'];
const STAR_CELLS = (() => {
  const W = 11, H = 9, fill = (x: number, y: number) => y >= 1 && y <= 7 && x >= 1 && x <= 9 && STAR[y - 1][x - 1] === '#';
  const out: { x: number; y: number; ink: boolean }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (fill(x, y)) out.push({ x, y, ink: false });
    else if (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1)) out.push({ x, y, ink: true });
  }
  return out;
})();
function Star({ on }: { on: boolean }) {
  return (
    <Svg width={33} height={27} viewBox="0 0 11 9">
      {STAR_CELLS.map((c) => <Rect key={c.x + ',' + c.y} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.ink ? C.ink : on ? C.sun : C.white} />)}
    </Svg>
  );
}

// fades and rises into place when it first appears
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, [v, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>{children}</Animated.View>;
}

function Blink({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.35, duration: 600, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={{ opacity: v }}>{children}</Animated.View>;
}

export function ForecastScreen() {
  const s = useStore();
  const spot = s.spot;
  const { st, refresh, refreshing } = useForecast(spot);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [trustOpen, setTrustOpen] = useState(false);
  const [nearby, setNearby] = useState<NearbySpot[] | null>(null);

  const data = st.status === 'ready' ? st.data : null;
  const report = useMemo(() => (data && spot ? buildReport(data, spot, s.skill, s.units) : null), [data, spot, s.skill, s.units]);

  // new beach: close any open day
  useEffect(() => { setOpenDay(null); setTrustOpen(false); setNearby(null); }, [spot]);

  // announce the answer with a sound when the user has just picked a beach
  const announced = useRef(s.announce);
  useEffect(() => {
    if (report && announced.current !== s.announce) { announced.current = s.announce; fx.verdict(report.hero.verdict); }
  }, [report, s.announce]);

  // nearby beaches load after the main report so they never slow it down
  const nkey = spot ? keyOf(spot) + s.skill : '';
  useEffect(() => {
    if (!data || !spot) return;
    let live = true;
    loadNearby(BEACHES, spot, s.skill).then((n) => { if (live) setNearby(n); }).catch(() => { if (live) setNearby([]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, nkey]);

  if (!spot) return null;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { fx.swoosh(); void refresh(); }} tintColor={C.ink} />}
    >
      {/* which beach */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Press label={s.isFav ? 'Remove from saved beaches' : 'Save this beach'} onPress={() => { fx.select(); s.toggleFav(); }}
          style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: s.isFav ? C.sun : C.foam, borderWidth: PX, borderColor: C.ink }}>
          <Star on={s.isFav} />
        </Press>
        <Press label="Change beach" onPress={() => { fx.tap(); s.go('map'); }} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: C.foam, borderWidth: PX, borderColor: C.ink, paddingHorizontal: 12, minHeight: 60 }}>
            <View style={{ flex: 1 }}>
              <T px size={12} numberOfLines={2}>{spot.name}</T>
              <T size={20} color={C.inkSoft} numberOfLines={1}>{spot.region}</T>
            </View>
            <View style={{ backgroundColor: C.sun, borderWidth: 3, borderColor: C.ink, paddingVertical: 9, paddingHorizontal: 8 }}>
              <T px size={9}>CHANGE</T>
            </View>
          </View>
        </Press>
      </View>

      {s.favs.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
          {s.favs.map((f) => (
            <Press key={f.name + f.region} label={'Open ' + f.name} onPress={() => { fx.select(); s.pick(f); }}
              style={{ backgroundColor: sameSpot(f, spot) ? C.sun : C.foam, borderWidth: 3, borderColor: C.ink, paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' }}>
              <T size={21}>{f.name}</T>
            </Press>
          ))}
        </ScrollView>
      ) : null}

      {st.status === 'loading' ? (
        <View style={{ marginTop: 14 }}>
          <Card>
            <PixelScene ft={2.5} wind="offshore" mph={8} sky="day" />
            <View style={{ padding: 14, alignItems: 'center' }}>
              <Blink><T px size={11}>CHECKING THE OCEAN...</T></Blink>
              <T size={20} color={C.inkSoft} style={{ marginTop: 8, textAlign: 'center' }}>Reading buoys, tides and wave models</T>
            </View>
          </Card>
        </View>
      ) : null}

      {st.status === 'error' ? (
        <Card style={{ marginTop: 14, padding: 16 }} bg={C.cream}>
          <T px size={11}>NO FORECAST</T>
          <T size={23} style={{ marginTop: 8 }}>{st.message}</T>
          <Press label="Try again" onPress={() => { fx.tap(); void refresh(); }} style={{ marginTop: 12, backgroundColor: C.sun, borderWidth: PX, borderColor: C.ink, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
            <T px size={10}>TRY AGAIN</T>
          </Press>
        </Card>
      ) : null}

      {report && data ? (
        <>
          {/* the big answer */}
          <Reveal>
            <Card style={{ marginTop: 14, overflow: 'hidden' }} bg={CLS_SOFT[report.hero.cls]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12 }}>
                <View style={{ backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 6 }}><T px size={10} color={C.white}>{report.hero.when}</T></View>
                <T px size={9}>SHOULD I SURF?</T>
              </View>
              <T px size={report.hero.word.length > 8 ? 26 : 34} style={{ paddingHorizontal: 14, paddingTop: 14 }}>{report.hero.word}</T>
              <T size={25} style={{ paddingHorizontal: 14, paddingTop: 8 }}>{report.hero.why}</T>
              {report.hero.facts.length ? (
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12 }}>
                  {report.hero.facts.map((f) => (
                    <View key={f.k} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 3, borderColor: C.ink, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', minWidth: 0 }}>
                      <T px size={7}>{f.k}</T>
                      <T size={f.v.length > 9 ? 20 : 25} style={{ marginTop: 5, textAlign: 'center' }} numberOfLines={2}>{f.v}</T>
                      {f.sub ? <T size={18} color={C.inkSoft} style={{ textAlign: 'center' }}>{f.sub}</T> : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {report.hero.score > 0 ? (
                <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <T px size={7}>SURF SCORE</T><T px size={7}>{report.hero.score}/100</T>
                  </View>
                  <Meter score={report.hero.score} color={CLS[report.hero.cls]} />
                </View>
              ) : null}
              <View style={{ marginTop: 14, borderTopWidth: PX, borderColor: C.ink }}>
                <PixelScene ft={report.hero.ft} wind={report.hero.wind} mph={report.hero.mph} sky={report.hero.dusk ? 'dusk' : 'day'} />
              </View>
            </Card>
          </Reveal>

          <Reveal delay={80}>
            <Card style={{ marginTop: 14, padding: 14 }} bg={C.cream}>
              <T px size={9} color={C.inkSoft}>BEST DAY THIS WEEK</T>
              <T px size={13} style={{ marginTop: 8 }}>{report.best.main}</T>
              <T size={23} style={{ marginTop: 6 }}>{report.best.sub}</T>
            </Card>
          </Reveal>

          <Heading>RIGHT NOW</Heading>
          <Card>
            {report.now.map((r, i) => (
              <View key={r.k}>
                {i ? <Divider /> : null}
                <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'flex-start' }}>
                  <T px size={9} color={C.seaDeep} style={{ width: 66, paddingTop: 7 }}>{r.k}</T>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <T size={29}>{r.v}</T>
                      {r.arrow !== undefined ? <Arrow from={r.arrow} /> : null}
                    </View>
                    <T size={21} color={C.inkSoft}>{r.sub}</T>
                  </View>
                </View>
              </View>
            ))}
          </Card>

          {nearby && nearby.length ? (
            <>
              <Heading>NEARBY BEACHES</Heading>
              <T size={20} color={C.inkSoft} style={{ marginTop: -4, marginBottom: 8 }}>How the closest breaks look today. Tap one to open it.</T>
              <Card>
                {nearby.slice(0, 5).map((n, i) => (
                  <View key={n.spot.id}>
                    {i ? <Divider /> : null}
                    <Press label={'Open ' + n.spot.name} onPress={() => { fx.select(); s.pick(n.spot); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, minHeight: 60 }}>
                      <View style={{ flex: 1 }}>
                        <T size={25} numberOfLines={1}>{n.spot.name}</T>
                        <T size={19} color={C.inkSoft} numberOfLines={1}>
                          {dist(n.km, s.units)} away{n.bestScore >= 30 ? ' · best ' + hourLabel(n.bestHour) : ''}
                        </T>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <T size={23}>{sizeText(n.bestFt / 3.28084, s.units)}</T>
                        <Chip label={CHIP[n.label]} color={CLS[n.cls as Cls]} style={{ paddingVertical: 4, paddingHorizontal: 8 }} />
                      </View>
                    </Press>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <Heading>THIS WEEK</Heading>
          <T size={20} color={C.inkSoft} style={{ marginTop: -4, marginBottom: 8 }}>Tap a day to see it hour by hour.</T>
          <View style={{ gap: 8 }}>
            {report.week.map((w) => (
              <View key={w.d}>
                <Press label={w.name + ', ' + w.chip} onPress={() => { fx.tap(); ease(); setOpenDay(openDay === w.d ? null : w.d); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: openDay === w.d ? C.cream : C.foam, borderWidth: PX, borderColor: C.ink, paddingHorizontal: 10, minHeight: 64 }}>
                  <View style={{ width: 54 }}>
                    <T px size={10}>{w.name}</T>
                    <T size={17} color={C.inkSoft}>{w.date}</T>
                  </View>
                  <Chip label={w.chip} color={CLS[w.cls]} style={{ width: 78 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={26} numberOfLines={1}>{w.size}</T>
                    <T size={18} color={C.inkSoft} numberOfLines={1}>{w.time ? w.time : w.conf}</T>
                  </View>
                </Press>
                {openDay === w.d ? <DayPanel data={data} rated={report.rated} wins={report.wins} d={w.d} units={s.units} /> : null}
              </View>
            ))}
          </View>

          <Card style={{ marginTop: 22 }}>
            <Press label="Can I trust this?" onPress={() => { fx.tap(); ease(); setTrustOpen(!trustOpen); }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
              <T px size={10}>CAN I TRUST THIS?</T>
              <T px size={14}>{trustOpen ? '-' : '+'}</T>
            </Press>
            {trustOpen ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
                {report.trust.map((t) => (
                  <View key={t.k} style={{ marginBottom: 12 }}>
                    <T px size={8} color={C.seaDeep} style={{ marginBottom: 3 }}>{t.k}</T>
                    <T size={22}>{t.text}</T>
                    {t.link ? (
                      <Press label="Open the buoy page" onPress={() => { fx.tap(); void Linking.openURL(t.link as string); }}>
                        <T size={21} color={C.seaDeep} style={{ textDecorationLine: 'underline' }}>See this buoy on the NOAA site</T>
                      </Press>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </Card>

          <T size={19} color={C.inkSoft} style={{ marginTop: 16, textAlign: 'center' }}>
            Updated {ago(st.status === 'ready' ? st.at : Date.now())}. Pull down to refresh.
          </T>
          <T size={18} color={C.inkSoft} style={{ marginTop: 4, textAlign: 'center' }}>
            Forecasts are predictions, not a promise. Always look at the water before you paddle out.
          </T>
        </>
      ) : null}
    </ScrollView>
  );
}
