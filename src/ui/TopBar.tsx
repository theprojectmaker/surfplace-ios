// The bar across the top of every screen: the beach you are looking at, how it looks right now,
// and where you are compared with it.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { BEACHES } from '../data/beaches';
import { youLine, nearestSpot } from '../engine/where';
import { fx } from '../sound';
import { useStore } from '../store';
import { C, CLS, PX } from '../theme';
import { Chip, Icon, Press, T } from './kit';

export function TopBar({ top }: { top: number }) {
  const s = useStore();
  const spot = s.spot;
  const nearest = useMemo(() => (s.me ? nearestSpot(BEACHES, s.me.lat, s.me.lon) : null), [s.me]);
  if (!spot) return <View style={{ height: top + 60, backgroundColor: C.sea, borderBottomWidth: PX, borderColor: C.ink }} />;
  const line = youLine(s.me, spot, nearest, s.units);

  return (
    <View style={{ backgroundColor: C.sea, paddingTop: top + 8, paddingBottom: 8, paddingHorizontal: 14, borderBottomWidth: PX, borderColor: C.ink }}>
      {/* the beach you are looking at; tap to change it */}
      <Press label={'Looking at ' + spot.name + '. Tap to change beach.'} onPress={() => { fx.tap(); s.go('map'); }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, backgroundColor: C.sun, borderWidth: 3, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="wave" size={30} color={C.seaDeep} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T fit px size={13} color={C.white} style={{ textShadowColor: C.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>{spot.name}</T>
            <T numberOfLines={1} size={19} color="#eaf8ff">{spot.region}</T>
          </View>
          <View style={{ alignItems: 'center', minWidth: 76 }}>
            {s.status ? (
              <>
                <Chip label={s.status.chip} color={CLS[s.status.cls]} style={{ alignSelf: 'stretch' }} />
                <T size={20} color={C.white} style={{ marginTop: 3 }}>{s.status.size}{s.status.water ? ' · ' + s.status.water : ''}</T>
              </>
            ) : (
              <T px size={9} color="#eaf8ff">LOADING</T>
            )}
          </View>
        </View>
      </Press>

      {/* where you are; tap to find (or refresh) your position */}
      <Press label={s.me ? 'Refresh my location' : 'Show where I am'} onPress={() => { fx.tap(); void s.locate(true); }} style={{ marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(11,37,69,0.28)', paddingHorizontal: 10, paddingVertical: 5, minHeight: 40 }}>
          <Icon name="pin" size={24} color={s.me ? C.sun : '#eaf8ff'} />
          <T numberOfLines={2} size={23} color={C.white} style={{ flex: 1, textDecorationLine: s.me ? 'none' : 'underline' }}>{line}</T>
        </View>
      </Press>
    </View>
  );
}
