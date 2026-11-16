// App state: the chosen beach, saved beaches and settings (remembered between launches), plus
// where you are and how the chosen beach looks right now (both only kept while the app runs).
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SPOT, restoreSpot, sameSpot } from './data/beaches';
import { Cls } from './engine/forecast';
import { Skill, Spot, Units } from './engine/types';
import { Me } from './engine/where';
import { setPrefs } from './sound';

const KEY = 'surfplace.v2';
export type Tab = 'forecast' | 'map' | 'more';
export type Status = { chip: string; cls: Cls; size: string; water: string | null };

type Saved = { spot: Spot | null; favs: Spot[]; skill: Skill; units: Units; sound: boolean; ocean: boolean; haptics: boolean };
type Ctx = Saved & {
  ready: boolean;
  tab: Tab;
  /** bumps each time the user picks a beach, so the forecast screen knows to announce the result */
  announce: number;
  /** where you are, once the phone has told us (never saved, never sent anywhere) */
  me: Me | null;
  /** how the chosen beach looks right now, shown in the top bar */
  status: Status | null;
  setStatus: (s: Status | null) => void;
  /** find where you are; `ask` lets it show the permission question. Returns null if it could not. */
  locate: (ask: boolean) => Promise<Me | null>;
  go: (t: Tab) => void;
  pick: (s: Spot) => void;
  toggleFav: () => void;
  isFav: boolean;
  set: <K extends keyof Saved>(k: K, v: Saved[K]) => void;
};

const defaults: Saved = { spot: null, favs: [], skill: 'intermediate', units: 'us', sound: true, ocean: false, haptics: true };
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Saved>(defaults);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('forecast');
  const [announce, setAnnounce] = useState(0);
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const loaded = useRef(false);
  const locating = useRef(false);

  const locate = useCallback(async (ask: boolean): Promise<Me | null> => {
    if (locating.current) return null;
    locating.current = true;
    try {
      const Location = require('expo-location') as typeof import('expo-location');
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && ask) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let place: string | null = null;
      try {
        // the phone turns your position into a town name (iPhones ask Apple Maps; browsers cannot)
        const r = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const a = r[0];
        if (a) place = [a.city || a.district || a.subregion, a.region].filter(Boolean).join(', ') || null;
      } catch { /* no town name: the top bar uses the nearest beach instead */ }
      const next = { lat: pos.coords.latitude, lon: pos.coords.longitude, place };
      setMe(next);
      return next;
    } catch {
      return null;
    } finally {
      locating.current = false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      let next = defaults;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const j = JSON.parse(raw) as Partial<Saved>;
          next = {
            ...defaults, ...j,
            spot: restoreSpot(j.spot) || DEFAULT_SPOT,
            favs: (j.favs || []).map(restoreSpot).filter((x): x is Spot => !!x),
          };
        } else {
          next = { ...defaults, spot: DEFAULT_SPOT };
        }
      } catch { next = { ...defaults, spot: DEFAULT_SPOT }; }
      setPrefs({ sound: next.sound, ocean: next.ocean, haptics: next.haptics });
      setSaved(next);
      loaded.current = true;
      setReady(true);
      void locate(false); // if you already allowed location, show where you are without asking again
    })();
  }, [locate]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved]);

  const set = useCallback(<K extends keyof Saved>(k: K, v: Saved[K]) => {
    setSaved((s) => ({ ...s, [k]: v }));
    if (k === 'sound' || k === 'ocean' || k === 'haptics') setPrefs({ [k]: v } as Partial<Saved>);
  }, []);

  const pick = useCallback((s: Spot) => {
    setSaved((x) => ({ ...x, spot: s }));
    setStatus(null); // the new beach is loading
    setAnnounce((n) => n + 1);
    setTab('forecast');
  }, []);

  const toggleFav = useCallback(() => {
    setSaved((x) => {
      if (!x.spot) return x;
      const at = x.favs.findIndex((f) => sameSpot(f, x.spot));
      const favs = at >= 0 ? x.favs.filter((_, i) => i !== at) : [...x.favs, x.spot];
      return { ...x, favs };
    });
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...saved, ready, tab, announce, me, status, setStatus, locate, go: setTab, pick, toggleFav, set,
    isFav: !!saved.spot && saved.favs.some((f) => sameSpot(f, saved.spot)),
  }), [saved, ready, tab, announce, me, status, locate, pick, toggleFav, set]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}
