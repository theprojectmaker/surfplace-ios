// The surf journal: sessions you log after you surf, and the stats drawn from them. Pure logic,
// so it is unit tested. Sessions are stored on the phone only.
export type Session = {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  spot: string;
  region: string;
  stars: number;       // 1..5
  sizeFt: number;      // wave size you rode, in feet
  board: string;       // free text, e.g. 'shortboard'
  notes: string;
};

export type Board = { label: string; key: string };
export const BOARDS: Board[] = [
  { key: 'shortboard', label: 'Shortboard' },
  { key: 'fish', label: 'Fish' },
  { key: 'funboard', label: 'Funboard' },
  { key: 'longboard', label: 'Longboard' },
  { key: 'softtop', label: 'Soft-top' },
  { key: 'gun', label: 'Gun / step-up' },
  { key: 'bodyboard', label: 'Bodyboard' },
  { key: 'other', label: 'Other' },
];

export function newId(): string {
  return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
export function todayISO(d = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// days between two 'YYYY-MM-DD' dates (b - a), calendar days
export function daysBetween(a: string, b: string): number {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(b) - d(a)) / 86400000);
}

export type Stats = {
  total: number;
  thisMonth: number;
  thisYear: number;
  avgStars: number;          // 0 if none
  topSpot: { name: string; count: number } | null;
  best: Session | null;      // highest stars, newest wins ties
  biggest: Session | null;   // biggest wave
  streak: number;            // consecutive calendar days up to the most recent session (incl. today if logged)
  distinctSpots: number;
  lastDate: string | null;
};

export function stats(sessions: Session[], now = new Date()): Stats {
  if (!sessions.length) {
    return { total: 0, thisMonth: 0, thisYear: 0, avgStars: 0, topSpot: null, best: null, biggest: null, streak: 0, distinctSpots: 0, lastDate: null };
  }
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const yr = String(now.getFullYear());
  let thisMonth = 0, thisYear = 0, starSum = 0;
  const spotCount = new Map<string, number>();
  let best: Session | null = null, biggest: Session | null = null;
  for (const s of sorted) {
    if (s.date.startsWith(ym)) thisMonth++;
    if (s.date.startsWith(yr)) thisYear++;
    starSum += s.stars;
    spotCount.set(s.spot, (spotCount.get(s.spot) || 0) + 1);
    if (!best || s.stars > best.stars) best = s;              // sorted newest-first, so ties keep the newest
    if (!biggest || s.sizeFt > biggest.sizeFt) biggest = s;
  }
  let topSpot: Stats['topSpot'] = null;
  spotCount.forEach((count, name) => { if (!topSpot || count > topSpot.count) topSpot = { name, count }; });

  // streak: distinct calendar days in a row ending at the most recent session day
  const days = [...new Set(sorted.map((s) => s.date))]; // already newest-first and unique
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i], days[i - 1]) === 1) streak++;
    else break;
  }

  return {
    total: sessions.length, thisMonth, thisYear,
    avgStars: starSum / sessions.length,
    topSpot, best, biggest,
    streak, distinctSpots: spotCount.size, lastDate: sorted[0].date,
  };
}

export function monthLabel(iso: string): string {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return m[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
}
export function dayLabel(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, mo - 1, d).getDay()];
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo - 1];
  return wd + ' ' + m + ' ' + d;
}

// sessions grouped by month, newest month first, newest session first within
export function byMonth(sessions: Session[]): { month: string; items: Session[] }[] {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const groups: { month: string; items: Session[] }[] = [];
  for (const s of sorted) {
    const key = s.date.slice(0, 7);
    let g = groups.find((x) => x.month === key);
    if (!g) { g = { month: key, items: [] }; groups.push(g); }
    g.items.push(s);
  }
  return groups;
}
