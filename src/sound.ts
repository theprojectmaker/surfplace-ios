// Sound effects + haptics. Every sound is a small synthesized chiptune file in assets/sounds.
// Sounds respect the phone's silent switch and mix with whatever music is playing.
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Verdict } from './engine/report';

const FILES = {
  tap: require('../assets/sounds/tap.wav'),
  select: require('../assets/sounds/select.wav'),
  back: require('../assets/sounds/back.wav'),
  toggle: require('../assets/sounds/toggle.wav'),
  flag: require('../assets/sounds/flag.wav'),
  swoosh: require('../assets/sounds/swoosh.wav'),
  maybe: require('../assets/sounds/maybe.wav'),
  yes: require('../assets/sounds/yes.wav'),
  epic: require('../assets/sounds/epic.wav'),
  no: require('../assets/sounds/no.wav'),
};
export type Sfx = keyof typeof FILES;

const prefs = { sound: true, ocean: false, haptics: true };
const players: Partial<Record<Sfx, AudioPlayer>> = {};
let ocean: AudioPlayer | null = null;
let modeSet = false;

async function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  try { await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }); } catch { /* audio is optional */ }
}

function player(name: Sfx): AudioPlayer | null {
  try {
    let p = players[name];
    if (!p) { p = createAudioPlayer(FILES[name]); players[name] = p; }
    return p;
  } catch { return null; }
}

export function setPrefs(p: Partial<typeof prefs>) {
  Object.assign(prefs, p);
  if (p.ocean !== undefined) syncOcean();
}

function syncOcean() {
  try {
    if (prefs.ocean) {
      void ensureMode();
      if (!ocean) { ocean = createAudioPlayer(require('../assets/sounds/ocean.wav')); ocean.loop = true; ocean.volume = 0.4; }
      ocean.play();
    } else if (ocean) {
      ocean.pause();
    }
  } catch { /* ignore */ }
}

export function play(name: Sfx) {
  if (!prefs.sound) return;
  void ensureMode();
  const p = player(name);
  if (!p) return;
  try {
    p.seekTo(0).catch(() => {});
    p.play();
  } catch { /* ignore */ }
}

function buzz(kind: 'light' | 'select' | 'success' | 'warning') {
  if (!prefs.haptics) return;
  try {
    if (kind === 'select') void Haptics.selectionAsync();
    else if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch { /* haptics are optional */ }
}

export const fx = {
  tap: () => { play('tap'); buzz('light'); },
  select: () => { play('select'); buzz('select'); },
  back: () => { play('back'); buzz('light'); },
  toggle: () => { play('toggle'); buzz('select'); },
  flag: () => { play('flag'); buzz('select'); },
  swoosh: () => { play('swoosh'); },
  verdict: (v: Verdict) => {
    if (v === 'epic') { play('epic'); buzz('success'); }
    else if (v === 'yes') { play('yes'); buzz('success'); }
    else if (v === 'maybe') { play('maybe'); buzz('light'); }
    else { play('no'); buzz('warning'); }
  },
};

// preload the short sounds so the first tap is not late
export function warmUp() {
  (['tap', 'select', 'flag'] as Sfx[]).forEach((n) => { player(n); });
}
