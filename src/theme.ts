import { Cls } from './engine/forecast';

export const C = {
  ink: '#0b2545',
  inkSoft: '#46628a',
  sea: '#1e9bd7',
  seaDeep: '#1479b8',
  seaLight: '#7fd8f5',
  aqua: '#c9f1fb',
  foam: '#f6fdff',
  line: '#cfe3ee',
  sun: '#ffd23f',
  coral: '#ff6b4a',
  flat: '#a9bfce',
  poor: '#ef6b5b',
  fair: '#f6c443',
  good: '#3fc56a',
  epic: '#a566ee',
  cream: '#fff7d1',
  white: '#ffffff',
};

export const CLS: Record<Cls, string> = { flat: C.flat, poor: C.poor, fair: C.fair, good: C.good, epic: C.epic };
// soft backgrounds for the big answer card
export const CLS_SOFT: Record<Cls, string> = { flat: '#c3d4df', poor: '#f7a79c', fair: '#fbdc85', good: '#8fe3a8', epic: '#cfa8fa' };

export const F = { px: 'PressStart', body: 'VT323' };
export const PX = 4; // the thickness of a "pixel" border
