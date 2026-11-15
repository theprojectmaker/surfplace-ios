import * as Location from 'expo-location';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, TextInput, View } from 'react-native';
import { BEACHES, regions, search } from '../data/beaches';
import { dist } from '../engine/format';
import { km } from '../engine/live';
import { Spot } from '../engine/types';
import { fx } from '../sound';
import { useStore } from '../store';
import { C, PX } from '../theme';
import { Card, Press, T } from '../ui/kit';
import { PixelMap } from '../ui/PixelMap';

export function BeachesScreen() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [hint, setHint] = useState('Drag to move, pinch to zoom, tap a flag. Tap the coast for the nearest beach.');
  const [browse, setBrowse] = useState(false);
  const results = useMemo(() => search(q), [q]);

  if (!s.spot) return null;
  const choose = (b: Spot) => { fx.flag(); setQ(''); setFocus(false); s.pick(b); };

  const nearMe = async () => {
    fx.tap();
    setHint('Finding the closest surf beach...');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setHint('Location is off for SurfPlace. Turn it on in Settings, or search for a beach.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      // your location stays on this phone: it is only compared with the beach list
      let best: Spot | null = null, bd = Infinity;
      for (const b of BEACHES) {
        const d = km(pos.coords.latitude, pos.coords.longitude, b.lat, b.lon);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) { setHint('Closest surf beach: ' + best.name + ', about ' + dist(bd, s.units) + ' away.'); s.pick(best); }
    } catch {
      setHint('Could not get your location. Search for a beach, or tap the map.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 14, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, zIndex: 20 }}>
        <View style={{ flex: 1 }}>
          <TextInput
            value={q} onChangeText={setQ} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Search a beach..." placeholderTextColor={C.inkSoft} autoCorrect={false} autoCapitalize="none" returnKeyType="search"
            clearButtonMode="while-editing" accessibilityLabel="Search a beach"
            style={{ minHeight: 52, fontFamily: 'VT323', fontSize: 25, color: C.ink, backgroundColor: C.white, borderWidth: PX, borderColor: C.ink, paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 8 : 4 }}
          />
          {focus && q.trim() ? (
            <View style={{ position: 'absolute', top: 52, left: 0, right: -118, maxHeight: 340, backgroundColor: C.white, borderWidth: PX, borderTopWidth: 0, borderColor: C.ink, zIndex: 30 }}>
              {results.length ? (
                <FlatList
                  data={results} keyExtractor={(b) => b.id} keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Press label={item.name} onPress={() => choose(item)} style={{ paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 2, borderColor: C.line }}>
                      <T size={24} numberOfLines={1}>{item.name}</T>
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
        <Press label="Find the closest beach to me" onPress={nearMe} style={{ backgroundColor: C.sun, borderWidth: PX, borderColor: C.ink, minHeight: 52, paddingHorizontal: 10, justifyContent: 'center' }}>
          <T px size={9}>NEAR ME</T>
        </Press>
      </View>

      <View style={{ flex: 1, marginTop: 10 }}>
        <PixelMap spot={s.spot} onPick={(b) => { s.pick(b); }} active={s.tab === 'map'} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 }}>
        <T size={19} color={C.inkSoft} style={{ flex: 1 }}>{hint}</T>
        <Press label="Browse all beaches by state or country" onPress={() => { fx.tap(); setBrowse(true); }} style={{ backgroundColor: C.foam, borderWidth: PX, borderColor: C.ink, minHeight: 48, paddingHorizontal: 10, justifyContent: 'center' }}>
          <T px size={8}>BROWSE</T>
        </Press>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: C.sea, borderBottomWidth: PX, borderColor: C.ink }}>
          <Press label={cur ? 'Back to the list of places' : 'Close'} onPress={() => { fx.back(); if (cur) setRegion(null); else onClose(); }} style={{ backgroundColor: C.sun, borderWidth: 3, borderColor: C.ink, paddingVertical: 10, paddingHorizontal: 12 }}>
            <T px size={9}>{cur ? 'BACK' : 'CLOSE'}</T>
          </Press>
          <T px size={11} color={C.white} style={{ flex: 1 }} numberOfLines={2}>{cur ? cur.name.toUpperCase() : 'ALL BEACHES'}</T>
        </View>
        {cur ? (
          <FlatList
            data={cur.beaches} keyExtractor={(b) => b.id} contentContainerStyle={{ padding: 14 }}
            renderItem={({ item }) => (
              <Press label={item.name} onPress={() => onPick(item)} style={{ backgroundColor: C.foam, borderWidth: 3, borderColor: C.ink, padding: 12, marginBottom: 8, minHeight: 52, justifyContent: 'center' }}>
                <T size={25}>{item.name}</T>
              </Press>
            )}
          />
        ) : (
          <FlatList
            data={all} keyExtractor={(r) => r.name} contentContainerStyle={{ padding: 14 }}
            ListHeaderComponent={<T size={20} color={C.inkSoft} style={{ marginBottom: 10 }}>{BEACHES.length} beaches. United States first.</T>}
            renderItem={({ item }) => (
              <Card style={{ marginBottom: 8 }}>
                <Press label={item.name} onPress={() => { fx.select(); setRegion(item.name); }} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, minHeight: 56 }}>
                  <T size={25} style={{ flex: 1 }} numberOfLines={1}>{item.name}</T>
                  <T size={22} color={C.inkSoft}>{item.beaches.length}</T>
                </Press>
              </Card>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
