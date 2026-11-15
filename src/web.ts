import { Platform } from 'react-native';

// Browser-only page setup: a full-height page that never scrolls or bounces by itself (the
// app's own screens scroll), no accidental text selection, and no page zoom on the map.
export function setupWeb() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent =
    'html,body,#root{height:100%;height:100dvh;margin:0;overflow:hidden;overscroll-behavior:none;background:#0b2545;-webkit-text-size-adjust:100%;}' +
    'body{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}' +
    'input{-webkit-user-select:text;user-select:text;}';
  document.head.appendChild(el);
}
