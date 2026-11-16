import React, { useMemo, useState } from 'react';
import { FlatList, Modal, TextInput, View } from 'react-native';
import { BEACHES, regions, search } from '../data/beaches';
import { dist } from '../engine/format';
import { nearestSpot } from '../engine/where';
import { Spot } from '../engine/types';
import { fx } from '../sound';
import { useStore } from '../store';
import { C, PX } from '../theme';
import { Box, Icon, PButton, Press, T } from '../ui/kit';
import { PixelMap } from '../ui/PixelMap';

const TOP = 78;     // room for the floating search bar
const BOTTOM = 118; // room for the selected-beach card

export function BeachesScreen() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [hint, setHint] = useState('Drag to move, pinch to zoom. Tap a flag, or tap the coast.');
  const [browse, setBrowse] = useState(false);
  const results = useMemo(() => search(q), [q]);

  if (!s.spot) return null;
  const choose = (b: Spot) => { fx.flag(); setQ(''); setFocus(false); s.pick(b); };

  const nearMe = async () => {
    fx.tap();
    setHint('Finding the closest surf beach...');
    // your location stays on this phone: it is only compared with the beach list
    const me = await s.locate(true);
    if (!me) { setHint('Could not get your location. Turn it on for SurfPlace in Settings, or search for a beach.'); return; }
    const n = nearestSpot(BEACHES, me.lat, me.lon);
    if (n) { setHint('Closest surf beach: ' + n.spot.name + ', about ' + dist(n.km, s.units) + ' away.'); s.pick(n.spot); }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* the map fills the whole screen; everything else floats on top of it */}
      <PixelMap spot={s.spot} onPick={(b) => { s.pick(b); }} active={s.tab === 'map'} inset={{ top: TOP, bottom: BOTTOM }} />

      <View style={{ position: 'absolute', left: 12, right: 12, top: 12, zIndex: 20, flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Box pad={0} bg={C.white}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8, gap: 6 }}>
              <Icon name="pin" size={20} color={C.coral} />
              <TextInput
                value={q} onChangeText={setQ} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
                placeholder="Search a beach..." placeholderTextColor={C.inkSoft} autoCorrect={false} autoCapitalize="none" returnKeyType="search"
                clearButtonMode="while-editing" accessibilityLabel="Search a beach"
                style={{ flex: 1, height: 46, fontFamily: 'VT323', fontSize: 26, color: C.ink, paddingVertical: 0 }}
              />
            </View>
          </Box>
          {focus && q.trim() ? (
            <View style={{ position: 'absolute', top: 56, left: 0, right: -120, maxHeight: 330, backgroundColor: C.white, borderWidth: PX, borderColor: C.ink, zIndex: 30 }}>
              {results.length ? (
                <FlatList
                  data={results} keyExtractor={(b) => b.id} keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Press label={item.name} onPress={() => choose(item)} style={{ paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 2, borderColor: C.line }}>
                      <T size={25} numberOfLines={1}>{item.name}</T>
                      <T size={19} color={C.inkSoft} numberOfLines={1}>{item.region}</T>
                    </Press>
                  )}
                />
              ) : (
                <View style={{ padding: 12 }}><T size={22} color={C.inkSoft}>No beach by that name. Tap the coast on the map instead.</T></View>
              )}
            </View>
          ) : null}
        </View>
        <PButton label="NEAR ME" a11y="Find the closest beach to me" size={9} pad={13} onPress={nearMe} />
      </View>

      {/* the beach you have chosen */}
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        <Box pad={8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <T px size={11} numberOfLines={1}>{s.spot.name}</T>
              <T size={20} color={C.inkSoft} numberOfLines={1}>{s.spot.region}</T>
            </View>
            <PButton label="FORECAST" a11y={'Open the forecast for ' + s.spot.name} size={9} pad={9} onPress={() => { fx.select(); s.go('forecast'); }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <T size={19} color={C.inkSoft} style={{ flex: 1 }} numberOfLines={2}>{hint}</T>
            <PButton label="BROWSE" a11y="Browse all beaches by state or country" bg={C.white} size={8} pad={7} onPress={() => { fx.tap(); setBrowse(true); }} />
          </View>
        </Box>
      </View>

      <BrowseModal visible={browse} onClose={() => setBrowse(false)} onPick={(b) => { setBrowse(false); choose(b); }} />
    </View>
  );
}

// every state and country, then its beaches
function BrowseModal({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (b: Spot) => void }) {
  const [region, setRegion] = useState<string | null>(null);
  const all = useMemo(() => regions(), []);
  const cur = region ? all.find((r) => r.name === region) : null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.aqua }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: C.sea, borderBottomWidth: PX, borderColor: C.ink }}>
          <PButton label={cur ? 'BACK' : 'CLOSE'} a11y={cur ? 'Back to the list of places' : 'Close'} size={9} pad={9} onPress={() => { fx.back(); if (cur) setRegion(null); else onClose(); }} />
          <T px size={11} color={C.white} style={{ flex: 1 }} numberOfLines={2}>{cur ? cur.name.toUpperCase() : 'ALL BEACHES'}</T>
        </View>
        {cur ? (
          <FlatList
            data={cur.beaches} keyExtractor={(b) => b.id} contentContainerStyle={{ padding: 14, gap: 10 }}
            renderItem={({ item }) => (
              <Press label={item.name} onPress={() => onPick(item)}>
                <Box pad={6}><View style={{ minHeight: 40, justifyContent: 'center' }}><T size={26}>{item.name}</T></View></Box>
              </Press>
            )}
          />
        ) : (
          <FlatList
            data={all} keyExtractor={(r) => r.name} contentContainerStyle={{ padding: 14, gap: 10 }}
            ListHeaderComponent={<T size={21} color={C.inkSoft} style={{ marginBottom: 6 }}>{BEACHES.length} beaches. United States first.</T>}
            renderItem={({ item }) => (
              <Press label={item.name} onPress={() => { fx.select(); setRegion(item.name); }}>
                <Box pad={6}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
                    <T size={26} style={{ flex: 1 }} numberOfLines={1}>{item.name}</T>
                    <T size={23} color={C.inkSoft}>{item.beaches.length}</T>
                  </View>
                </Box>
              </Press>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
