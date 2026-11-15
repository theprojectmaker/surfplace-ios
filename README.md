# SurfPlace (iPhone)

All the surf knowledge you need in one app. A pixel-art surf forecaster: pick a beach, get a plain yes/no on whether to surf, the best time to go, and a 7-day outlook.

- `web/` is the SurfPlace web app. `tools/build-native.mjs` packs it into `src/page.js`, one self-contained page.
- `App.tsx` shows that page in a full-screen WebView, fetches NOAA buoy and tide feeds for it, and provides the phone's location for NEAR ME.
- Forecasts: Open-Meteo marine and weather models. Live readings: NOAA NDBC buoys and NOAA CO-OPS tide stations.
- Beaches: USGS Geographic Names Information System (public domain) and OpenStreetMap (© OpenStreetMap contributors, ODbL). Coastline: Natural Earth.

After changing the web app run `npm run build:web`, then commit. Every push to `main` builds on GitHub Actions and ships to TestFlight.
