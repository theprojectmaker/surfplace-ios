// Plain-language wording and unit formatting. Everything here is a pure function.
import { clock, M2FT, Cls, ForecastData, Label, WindInfo, WindType, Win } from './forecast';
import { Skill, Units } from './types';

export const hourLabel = (h: number) => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? ' AM' : ' PM');
export const hourShort = (h: number) => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? 'a' : 'p');
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const WORDS8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compass = (d: number) => WORDS8[Math.round(((d % 360) + 360) % 360 / 45) % 8];
const SHORT16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compassShort = (d: number) => SHORT16[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];

export function sizeText(m: number, units: Units): string {
  const ft = m * M2FT;
  if (ft < 0.8) return 'Flat';
  if (units === 'us') {
    const lo = Math.max(1, Math.round(ft * 0.85));
    return lo + '-' + Math.max(lo + 1, Math.round(ft * 1.15)) + ' ft';
  }
  return (m * 0.85).toFixed(1) + '-' + (m * 1.15).toFixed(1) + ' m';
}
export const height = (m: number, units: Units) => (units === 'us' ? (m * M2FT).toFixed(1) + ' ft' : m.toFixed(1) + ' m');
export const speed = (kmh: number, units: Units) => (units === 'us' ? Math.round(kmh * 0.621371) + ' mph' : Math.round(kmh) + ' km/h');
export const temp = (c: number | null, units: Units) => (c === null ? '--' : units === 'us' ? Math.round(c * 9 / 5 + 32) + '°F' : Math.round(c) + '°C');
export const dist = (km: number, units: Units) => (units === 'us' ? Math.round(km * 0.621) + ' miles' : Math.round(km) + ' km');

export function bodyHeight(ft: number): string {
  if (ft < 1) return 'no';
  if (ft < 2) return 'ankle-high';
  if (ft < 3) return 'knee-high';
  if (ft < 4) return 'waist-high';
  if (ft < 5.5) return 'chest-high';
  if (ft < 7) return 'head-high';
  if (ft < 10) return 'overhead';
  if (ft < 15) return 'huge';
  return 'giant';
}

export const WIND_WORD: Record<WindType, string> = {
  glassy: 'Calm', offshore: 'Clean', 'cross-offshore': 'Mostly clean', 'cross-shore': 'Bumpy',
  onshore: 'Messy', light: 'Light', breezy: 'Breezy', strong: 'Strong',
};
export const WIND_WHY: Record<WindType, string> = {
  glassy: 'Smooth water', offshore: 'Blowing out to sea', 'cross-offshore': 'Mostly out to sea',
  'cross-shore': 'Blowing sideways', onshore: 'Blowing in off the sea', light: 'Light wind', breezy: 'Some chop', strong: 'Rough water',
};
export function windPlain(w: WindInfo): string {
  const s = w.mph < 5 ? '' : w.mph < 12 ? 'light ' : w.mph < 20 ? 'medium ' : 'strong ';
  switch (w.type) {
    case 'glassy': return 'almost no wind, smooth water';
    case 'offshore': return s + 'wind blowing out to sea, which keeps waves clean';
    case 'cross-offshore': return s + 'wind blowing mostly out to sea, fairly clean';
    case 'cross-shore': return s + 'sideways wind, a little bumpy';
    case 'onshore': return s + 'wind blowing in from the sea, which makes waves messy';
    default: return s + 'wind';
  }
}

export function weather(code: number): string {
  if (code === 0) return 'clear sky';
  if (code <= 2) return 'partly cloudy';
  if (code === 3) return 'cloudy';
  if (code <= 48) return 'foggy';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'showers';
  if (code <= 86) return 'snow showers';
  return 'thunderstorms, stay out of the water';
}

export function suit(c: number | null): string {
  if (c === null) return 'no water temperature here';
  if (c >= 24) return 'boardshorts are fine';
  if (c >= 20) return 'wear a thin spring suit';
  if (c >= 16) return 'wear a 3/2 wetsuit';
  if (c >= 12) return 'wear a 4/3 wetsuit and boots';
  if (c >= 8) return 'wear a 5/4 wetsuit, boots, gloves and hood';
  return 'wear your thickest hooded wetsuit, boots and mitts';
}

export function board(ft: number, skill: Skill): [string, string] {
  if (ft < 1) return ['No board', 'Nothing to ride. Good day for a swim.'];
  if (ft < 2.5) return ['Longboard', 'Small waves need a big, floaty board.'];
  if (ft < 4.5) return skill === 'beginner'
    ? ['Soft-top', 'Stay in the whitewater close to shore.']
    : ['Fish or funboard', 'Or your everyday shortboard.'];
  if (ft < 7) return skill === 'beginner'
    ? ['Stay on the beach', 'These waves are too much for learning.']
    : ['Shortboard', 'Good size for a normal shortboard.'];
  if (ft < 12) return ['Step-up board', 'Bring a longer board for the extra size.'];
  return ['Big-wave gun', 'Experts only, and never alone.'];
}

export const CHIP: Record<Label, string> = { FLAT: 'FLAT', POOR: 'POOR', FAIR: 'OK', GOOD: 'GOOD', EPIC: 'EPIC', 'TOO BIG': 'TOO BIG' };
export const SURE = ['', 'Rough guess', 'Likely', 'Very likely'];
export const CLS_WORD: Record<Cls, string> = { flat: 'Flat', poor: 'Poor', fair: 'OK', good: 'Good', epic: 'Epic' };

// "6–10 AM" or "10 AM–2 PM"
export function rangeShort(data: Pick<ForecastData, 'hours'>, w: Pick<Win, 'a' | 'b'>): string {
  const hs = data.hours, a = hs[w.a].hour, b = (hs[w.b - 1].hour + 1) % 24;
  const n = (h: number) => (h % 12 === 0 ? 12 : h % 12), ap = (h: number) => (h < 12 ? 'AM' : 'PM');
  return ap(a) === ap(b) ? n(a) + '–' + n(b) + ' ' + ap(b) : n(a) + ' ' + ap(a) + '–' + n(b) + ' ' + ap(b);
}
export function winText(data: Pick<ForecastData, 'hours'>, w: Pick<Win, 'a' | 'b'>): string {
  const hs = data.hours;
  return hourLabel(hs[w.a].hour) + ' to ' + hourLabel((hs[w.b - 1].hour + 1) % 24);
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAYS_LONG = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
export function dayName(data: Pick<ForecastData, 'days'>, d: number, long = false): string {
  if (d === 0) return 'TODAY';
  if (d === 1 && long) return 'TOMORROW';
  const [y, m, dd] = data.days[d].date.split('-').map(Number);
  const wd = new Date(y, m - 1, dd).getDay();
  return long ? DAYS_LONG[wd] : DAYS[wd];
}
export function dateText(data: Pick<ForecastData, 'days'>, d: number): string {
  const [, m, dd] = data.days[d].date.split('-').map(Number);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + dd;
}

export function ago(time: number): string {
  const min = Math.max(0, Math.round((Date.now() - time) / 60000));
  return min < 60 ? min + ' minutes ago' : Math.floor(min / 60) + ' h ' + (min % 60) + ' min ago';
}

export const sunTime = (hours: number) => clock(hours * 60);

// ---------- moon + swell extras ----------
export function moonName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return 'New moon';
  if (phase < 0.22) return 'Waxing crescent';
  if (phase < 0.28) return 'First quarter';
  if (phase < 0.47) return 'Waxing gibbous';
  if (phase < 0.53) return 'Full moon';
  if (phase < 0.72) return 'Waning gibbous';
  if (phase < 0.78) return 'Last quarter';
  return 'Waning crescent';
}
export function tideStrength(phase: number): string {
  const nearNewFull = Math.min(Math.abs(phase), Math.abs(phase - 1), Math.abs(phase - 0.5));
  const nearQuarter = Math.min(Math.abs(phase - 0.25), Math.abs(phase - 0.75));
  if (nearNewFull < 0.08) return 'Big tide swings (spring tides)';
  if (nearQuarter < 0.07) return 'Small tide swings (neap tides)';
  return 'Medium tide swings';
}
// deep-water wave power in kW per metre of wave front: 0.49 * H^2 * T
export function swellPower(heightM: number, period: number): string {
  const p = 0.49 * heightM * heightM * period;
  if (p < 4) return 'weak';
  if (p < 15) return 'moderate';
  if (p < 40) return 'strong';
  return 'powerful';
}
export function uvWord(uv: number | null): string {
  if (uv === null) return '';
  if (uv < 3) return 'low';
  if (uv < 6) return 'moderate';
  if (uv < 8) return 'high';
  return 'very high';
}
