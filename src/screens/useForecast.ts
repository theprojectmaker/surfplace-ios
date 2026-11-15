import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ForecastData, loadForecast } from '../engine/forecast';
import { Spot } from '../engine/types';

type St =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; data: ForecastData; at: number }
  | { key: string; status: 'error'; message: string };

const cache = new Map<string, { at: number; data: ForecastData }>();
const FRESH = 10 * 60 * 1000;
export const keyOf = (s: Spot) => s.lat.toFixed(3) + ',' + s.lon.toFixed(3);

// Loads the forecast for a spot, shows a recent copy instantly when there is one, and
// refreshes by itself when the app comes back after a while.
export function useForecast(spot: Spot | null) {
  const key = spot ? keyOf(spot) : '';
  const [st, setSt] = useState<St>({ key, status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const run = useRef(0);

  const load = useCallback(async (force: boolean) => {
    if (!spot) return;
    const k = keyOf(spot);
    const hit = cache.get(k);
    if (hit && !force && Date.now() - hit.at < FRESH) { setSt({ key: k, status: 'ready', data: hit.data, at: hit.at }); return; }
    const id = ++run.current;
    if (!hit) setSt({ key: k, status: 'loading' });
    else setSt({ key: k, status: 'ready', data: hit.data, at: hit.at }); // show the older copy while the new one loads
    try {
      const data = await loadForecast(spot);
      cache.set(k, { at: Date.now(), data });
      if (id === run.current) setSt({ key: k, status: 'ready', data, at: Date.now() });
    } catch (e) {
      if (id !== run.current) return;
      const msg = e instanceof Error ? e.message : '';
      if (hit) return; // keep showing the older copy
      setSt({
        key: k, status: 'error',
        message: msg === 'NO_OCEAN'
          ? 'There is no ocean data at that spot. Go to BEACHES and tap a spot on the water, or pick a flag.'
          : 'Could not reach the forecast. Check your internet connection, then pull down to try again.',
      });
    }
  }, [spot]);

  useEffect(() => { void load(false); }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const hit = spot ? cache.get(keyOf(spot)) : null;
      if (!hit || Date.now() - hit.at > 30 * 60 * 1000) void load(true);
    });
    return () => sub.remove();
  }, [load, spot]);

  const refresh = useCallback(async () => { setRefreshing(true); await load(true); setRefreshing(false); }, [load]);
  // a result for a different spot than the one on screen counts as still loading
  const current: St = st.key === key ? st : { key, status: 'loading' };
  return { st: current, refresh, refreshing };
}
