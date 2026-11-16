// "Where am I?" wording for the top bar: your position compared with the beach on screen.
import { km } from './live';
import { Spot, Units } from './types';

export type Me = { lat: number; lon: number; place: string | null };

export function nearestSpot(all: Spot[], lat: number, lon: number): { spot: Spot; km: number } | null {
  let best: Spot | null = null, bd = Infinity;
  const c = Math.cos((lat * Math.PI) / 180);
  for (const b of all) {
    if (Math.abs(b.lat - lat) > 3) continue; // cheap skip: nothing that far north or south can be nearest
    const d = (b.lat - lat) ** 2 + ((b.lon - lon) * c) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) { // no beach within 3 degrees of latitude: do the full search
    for (const b of all) { const d = km(lat, lon, b.lat, b.lon); if (d < bd) { bd = d; best = b; } }
    return best ? { spot: best, km: bd } : null;
  }
  return { spot: best, km: km(lat, lon, best.lat, best.lon) };
}

// short distance for the tight top bar: "12 mi" or "19 km"
const short = (k: number, units: Units) => (units === 'us' ? Math.round(k * 0.621) + ' mi' : Math.round(k) + ' km');

// The line shown under the beach name.
export function youLine(me: Me | null, spot: Spot, nearest: { spot: Spot; km: number } | null, units: Units): string {
  if (!me) return 'Tap to show where you are';
  const d = km(me.lat, me.lon, spot.lat, spot.lon);
  if (d < 1.5) return "You're at this beach";
  if (nearest && nearest.km < 1.5) return "You're at " + nearest.spot.name + ' · ' + short(d, units) + ' from ' + spot.name;
  const where = me.place || (nearest ? 'near ' + nearest.spot.name : 'your location');
  return 'You: ' + where + ' · ' + short(d, units) + ' away';
}
