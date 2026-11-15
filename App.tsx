// SurfPlace native shell: one full-screen WebView holding the SurfPlace web app.
// The shell does two small jobs the page cannot do itself:
//   1. fetch NOAA's buoy and tide feeds (a web page is not allowed to read them directly)
//   2. ask iOS for the phone's location when the user taps NEAR ME
import React, { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

const BASE = 'https://surfplace.local/';
const BLUE = '#1e9bd7';
// the only hosts the shell will fetch on the page's behalf
const NOAA = ['www.ndbc.noaa.gov', 'api.tidesandcurrents.noaa.gov'];

function allowed(url: string): boolean {
  const m = /^https:\/\/([^/?#]+)\//.exec(url);
  return !!m && NOAA.includes(m[1].toLowerCase());
}

export default function App() {
  const ref = useRef<WebView>(null);
  const [page, setPage] = useState<string | null>(null);

  // The page is a few MB (it carries the world coastline), so load it after the first
  // frame instead of during launch.
  useEffect(() => {
    const t = setTimeout(() => setPage(require('./src/page.js') as string), 0);
    return () => clearTimeout(t);
  }, []);

  const reply = (id: string, ok: boolean, payload: string) =>
    ref.current?.injectJavaScript(`window.__spResolve&&window.__spResolve(${JSON.stringify(id)},${ok},${JSON.stringify(payload)});true;`);

  async function onMessage(e: WebViewMessageEvent) {
    let msg: { type?: string; id?: string; url?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    const id = msg.id;
    if (!id) return;
    if (msg.type === 'fetch') {
      if (!msg.url || !allowed(msg.url)) return reply(id, false, 'not allowed');
      try {
        const res = await fetch(msg.url);
        if (!res.ok) return reply(id, false, 'status ' + res.status);
        reply(id, true, await res.text());
      } catch {
        reply(id, false, 'network');
      }
    } else if (msg.type === 'locate') {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return reply(id, false, 'denied');
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        reply(id, true, JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude }));
      } catch {
        reply(id, false, 'unavailable');
      }
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BLUE }}>
      <StatusBar style="light" />
      {page ? (
        <WebView
          ref={ref}
          originWhitelist={['*']}
          source={{ html: page, baseUrl: BASE }}
          onMessage={onMessage}
          onContentProcessDidTerminate={() => ref.current?.reload()}
          onShouldStartLoadWithRequest={(r) => {
            if (r.url.startsWith(BASE) || r.url.startsWith('about:') || r.url.startsWith('blob:') || r.url.startsWith('data:')) return true;
            // links out of the app (the NOAA buoy page) open in Safari
            if (/^https?:\/\//.test(r.url)) Linking.openURL(r.url).catch(() => {});
            return false;
          }}
          bounces={false}
          overScrollMode="never"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          setSupportMultipleWindows={false}
          domStorageEnabled
          javaScriptEnabled
          style={{ flex: 1, backgroundColor: BLUE }}
        />
      ) : null}
    </View>
  );
}
