import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Linking, RefreshControl, ScrollView, View } from 'react-native';
import { BEACHES, sameSpot } from '../data/beaches';
import { Cls } from '../engine/forecast';
import { ago, CHIP, dist, hourLabel, sizeText } from '../engine/format';
import { loadNearby, NearbySpot } from '../engine/nearby';
import { buildReport } from '../engine/report';
import { fx } from '../sound';
import { useStore } from '../store';
import { C, CLS, CLS_SOFT, PX } from '../theme';
import { Arrow, Box, Chip, Divider, Heading, Icon, IconTile, Meter, PButton, Press, T } from '../ui/kit';
import { PixelScene } from '../ui/PixelScene';
import { DayPanel } from './DayPanel';
import { keyOf, useForecast } from './useForecast';

const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));

const ROW_ICON: Record<string, [string, string]> = {
  WAVES: ['wave', C.seaLight], SWELL: ['bars', '#b9e6ff'], WIND: ['wind', '#e3f4ff'], TIDE: ['tide', '#c8f0e0'],
  WATER: ['drop', '#9fe0f4'], AIR: ['cloud', '#e9f0f5'], SUN: ['sun', C.sun], MOON: ['moon', '#d9d4ff'], BOARD: ['board', '#ffd2c6'],
};

// fades and rises into place when it first appears
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 340, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, [v, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>{children}</Animated.View>;
}

// the big answer word springs in
function Pop({ children, k }: { children: React.ReactNode; k: string }) {
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => { v.setValue(0.5); Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start(); }, [k, v]);
  return <Animated.View style={{ transform: [{ scale: v }], alignSelf: 'flex-start' }}>{children}</Animated.View>;
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
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { fx.swoosh(); void refresh(); }} tintColor={C.ink} />}
    >
      {/* which beach */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Press label={s.isFav ? 'Remove from saved beaches' : 'Save this beach'} onPress={() => { fx.select(); s.toggleFav(); }} style={{ width: 64 }}>
          <Box bg={s.isFav ? C.sun : C.foam} pad={0} style={{ height: 64 }}>
            <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={30} color={s.isFav ? C.ink : C.seaDeep} /></View>
          </Box>
        </Press>
        <Press label="Change beach" onPress={() => { fx.tap(); s.go('map'); }} style={{ flex: 1 }}>
          <Box pad={4} style={{ minHeight: 64 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
              <View style={{ flex: 1 }}>
                <T px size={12} numberOfLines={2}>{spot.name}</T>
                <T size={21} color={C.inkSoft} numberOfLines={1}>{spot.region}</T>
              </View>
              <View style={{ backgroundColor: C.sun, borderWidth: 3, borderColor: C.ink, paddingVertical: 8, paddingHorizontal: 8 }}>
                <T px size={9}>CHANGE</T>
              </View>
            </View>
          </Box>
        </Press>
      </View>

      {s.favs.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -14 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingBottom: 6 }}>
          {s.favs.map((f) => (
            <Press key={f.name + f.region} label={'Open ' + f.name} onPress={() => { fx.select(); s.pick(f); }}>
              <Box bg={sameSpot(f, spot) ? C.sun : C.foam} pad={2} shadow={false}>
                <View style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' }}><T size={22}>{f.name}</T></View>
              </Box>
            </Press>
          ))}
        </ScrollView>
      ) : null}

      {st.status === 'loading' ? (
        <Box pad={0} style={{ marginTop: 16 }}>
          <PixelScene ft={2.5} wind="offshore" mph={8} sky="day" />
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Blink><T px size={11}>CHECKING THE OCEAN...</T></Blink>
            <T size={21} color={C.inkSoft} style={{ marginTop: 8, textAlign: 'center' }}>Reading buoys, tides and wave models</T>
          </View>
        </Box>
      ) : null}

      {st.status === 'error' ? (
        <Box bg={C.cream} pad={14} style={{ marginTop: 16 }}>
          <T px size={11}>NO FORECAST</T>
          <T size={24} style={{ marginTop: 8 }}>{st.message}</T>
          <PButton label="TRY AGAIN" style={{ marginTop: 14 }} onPress={() => { fx.tap(); void refresh(); }} />
        </Box>
      ) : null}

      {report && data ? (
        <>
          {/* the big answer */}
          <Reveal>
            <Box bg={CLS_SOFT[report.hero.cls]} pad={0} style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14 }}>
                <View style={{ backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 6 }}><T px size={10} color={C.white}>{report.hero.when}</T></View>
                <T px size={9}>SHOULD I SURF?</T>
              </View>
              <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
                <Pop k={spot.name + report.hero.word}>
                  <T px size={report.hero.word.length > 8 ? 28 : 38}>{report.hero.word}</T>
                </Pop>
              </View>
              <T size={26} style={{ paddingHorizontal: 14, paddingTop: 8 }}>{report.hero.why}</T>
              {report.hero.facts.length ? (
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 14 }}>
                  {report.hero.facts.map((f) => (
                    <View key={f.k} style={{ flex: 1, minWidth: 0 }}>
                      <Box bg="rgba(255,255,255,0.8)" pad={2} shadow={false}>
                        <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                          <T px size={7}>{f.k}</T>
                          <T size={f.v.length > 9 ? 21 : 26} style={{ marginTop: 5, textAlign: 'center' }} numberOfLines={2}>{f.v}</T>
                          {f.sub ? <T size={19} color={C.inkSoft} style={{ textAlign: 'center' }}>{f.sub}</T> : null}
                        </View>
                      </Box>
                    </View>
                  ))}
                </View>
              ) : null}
              {report.hero.score > 0 ? (
                <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <T px size={8}>SURF SCORE</T><T px size={8}>{report.hero.score}/100</T>
                  </View>
                  <Meter score={report.hero.score} color={CLS[report.hero.cls]} />
                </View>
              ) : null}
              <View style={{ margin: 14, borderWidth: PX, borderColor: C.ink }}>
                <PixelScene ft={report.hero.ft} wind={report.hero.wind} mph={report.hero.mph} sky={report.hero.dusk ? 'dusk' : 'day'} />
              </View>
            </Box>
          </Reveal>

          <Reveal delay={80}>
            <Box bg={C.cream} pad={12} style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="star" size={20} color={C.coral} />
                <T px size={9} color={C.inkSoft}>BEST DAY THIS WEEK</T>
              </View>
              <T px size={13} style={{ marginTop: 10 }}>{report.best.main}</T>
              <T size={24} style={{ marginTop: 6 }}>{report.best.sub}</T>
            </Box>
          </Reveal>

          <Heading>RIGHT NOW</Heading>
          <Box pad={0}>
            {report.now.map((r, i) => {
              const ic = ROW_ICON[r.k] || ROW_ICON.WAVES;
              return (
                <View key={r.k}>
                  {i ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' }}>
                    <IconTile name={ic[0]} bg={ic[1]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <T px size={8} color={C.seaDeep}>{r.k}</T>
                        {r.arrow !== undefined ? <Arrow from={r.arrow} size={14} color={C.seaDeep} /> : null}
                      </View>
                      <T size={30}>{r.v}</T>
                      <T size={21} color={C.inkSoft}>{r.sub}</T>
                    </View>
                  </View>
                </View>
              );
            })}
          </Box>

          {nearby && nearby.length ? (
            <>
              <Heading>NEARBY BEACHES</Heading>
              <T size={21} color={C.inkSoft} style={{ marginTop: -6, marginBottom: 10 }}>How the closest breaks look today. Tap one to open it.</T>
              <Box pad={0}>
                {nearby.slice(0, 5).map((n, i) => (
                  <View key={n.spot.id}>
                    {i ? <Divider /> : null}
                    <Press label={'Open ' + n.spot.name} onPress={() => { fx.select(); s.pick(n.spot); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, minHeight: 64 }}>
                      <Icon name="pin" size={26} color={C.coral} />
                      <View style={{ flex: 1 }}>
                        <T size={26} numberOfLines={1}>{n.spot.name}</T>
                        <T size={19} color={C.inkSoft} numberOfLines={1}>
                          {dist(n.km, s.units)} away{n.bestScore >= 30 ? ' · best ' + hourLabel(n.bestHour) : ''}
                        </T>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <T size={24}>{sizeText(n.bestFt / 3.28084, s.units)}</T>
                        <Chip label={CHIP[n.label]} color={CLS[n.cls as Cls]} style={{ minWidth: 64 }} />
                      </View>
                    </Press>
                  </View>
                ))}
              </Box>
            </>
          ) : null}

          <Heading>THIS WEEK</Heading>
          <T size={21} color={C.inkSoft} style={{ marginTop: -6, marginBottom: 10 }}>Tap a day to see it hour by hour.</T>
          <View style={{ gap: 12 }}>
            {report.week.map((w) => (
              <View key={w.d}>
                <Press label={w.name + ', ' + w.chip} onPress={() => { fx.tap(); ease(); setOpenDay(openDay === w.d ? null : w.d); }}>
                  <Box bg={openDay === w.d ? C.cream : C.foam} pad={2}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 }}>
                      <View style={{ width: 54 }}>
                        <T px size={10}>{w.name}</T>
                        <T size={18} color={C.inkSoft}>{w.date}</T>
                      </View>
                      <Chip label={w.chip} color={CLS[w.cls]} style={{ width: 80 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T size={27} numberOfLines={1}>{w.size}</T>
                        <T size={19} color={C.inkSoft} numberOfLines={1}>{w.time ? w.time : w.conf}</T>
                      </View>
                      <T px size={12} color={C.inkSoft}>{openDay === w.d ? '-' : '+'}</T>
                    </View>
                  </Box>
                </Press>
                {openDay === w.d ? <DayPanel data={data} rated={report.rated} wins={report.wins} d={w.d} units={s.units} /> : null}
              </View>
            ))}
          </View>

          <Box pad={0} style={{ marginTop: 26 }}>
            <Press label="Can I trust this?" onPress={() => { fx.tap(); ease(); setTrustOpen(!trustOpen); }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
              <T px size={10}>CAN I TRUST THIS?</T>
              <T px size={14}>{trustOpen ? '-' : '+'}</T>
            </Press>
            {trustOpen ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
                {report.trust.map((t) => (
                  <View key={t.k} style={{ marginBottom: 12 }}>
                    <T px size={8} color={C.seaDeep} style={{ marginBottom: 3 }}>{t.k}</T>
                    <T size={23}>{t.text}</T>
                    {t.link ? (
                      <Press label="Open the buoy page" onPress={() => { fx.tap(); void Linking.openURL(t.link as string); }}>
                        <T size={22} color={C.seaDeep} style={{ textDecorationLine: 'underline' }}>See this buoy on the NOAA site</T>
                      </Press>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </Box>

          <T size={20} color={C.inkSoft} style={{ marginTop: 18, textAlign: 'center' }}>
            Updated {ago(st.status === 'ready' ? st.at : Date.now())}. Pull down to refresh.
          </T>
          <T size={19} color={C.inkSoft} style={{ marginTop: 4, textAlign: 'center' }}>
            Forecasts are predictions, not a promise. Always look at the water before you paddle out.
          </T>
        </>
      ) : null}
    </ScrollView>
  );
}
