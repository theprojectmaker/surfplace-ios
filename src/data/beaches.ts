import { Spot } from '../engine/types';

type Row = [string, string, number, number, number, number];
const rows = require('./beaches.json') as Row[];

// Famous spots come first in the file, so declutter picks them before the small ones.
export const BEACHES: Spot[] = rows.map((r, i) => ({
  id: 'b' + i, name: r[0], region: r[1], lat: r[2], lon: r[3], facing: r[4], top: r[5] === 1,
}));

export const sameSpot = (a: Spot | null | undefined, b: Spot | null | undefined) =>
  !!a && !!b && a.name === b.name && a.region === b.region && Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;

// A saved spot is matched back to the list by name and place, so the list can grow safely.
export function restoreSpot(saved: Spot | null | undefined): Spot | null {
  if (!saved) return null;
  if (saved.custom) return saved;
  return BEACHES.find((b) => sameSpot(b, saved)) || BEACHES.find((b) => b.name === saved.name && b.region === saved.region) || null;
}

export const DEFAULT_SPOT: Spot = BEACHES.find((b) => b.name === 'Long Beach' && b.region === 'New York, USA') || BEACHES[0];

const isUS = (n: string) => / USA$|Hawaii$|^Puerto Rico$/.test(n);

// every state / country with its beaches, US first
export function regions(): { name: string; beaches: Spot[] }[] {
  const map = new Map<string, Spot[]>();
  for (const b of BEACHES) {
    const arr = map.get(b.region);
    if (arr) arr.push(b); else map.set(b.region, [b]);
  }
  return [...map.entries()]
    .map(([name, beaches]) => ({ name, beaches: beaches.slice().sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => (isUS(a.name) === isUS(b.name) ? a.name.localeCompare(b.name) : isUS(a.name) ? -1 : 1));
}

export function search(q: string, limit = 25): Spot[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const rank = (b: Spot) => (b.name.toLowerCase().startsWith(s) ? 0 : 2) + (b.top ? 0 : 1);
  return BEACHES.filter((b) => (b.name + ' ' + b.region).toLowerCase().includes(s))
    .sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}
