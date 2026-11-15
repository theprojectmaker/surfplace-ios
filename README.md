# SurfPlace (iPhone)

All the surf knowledge you need in one app. A native iPhone app (React Native / Expo, real iOS views, no web page inside) with a pixel-art look: pick a beach, get a plain yes/no on whether to surf, the best time to go, a 7-day outlook, live buoy and tide readings, nearby beaches and a surf-knowledge library.

- `App.tsx`, `src/screens/` - Forecast, Beaches (live pixel map) and More screens.
- `src/engine/` - the forecast logic (pure TypeScript, unit tested): Open-Meteo wave and weather models, NOAA buoy calibration, NOAA tides, ratings, best-time windows, plain-language report, nearby beaches.
- `src/map/` - the map is drawn by the app from the world coastline (no map service): `coast.ts` is the land/sea index, `raster.ts` turns the visible area into pixels.
- `src/sound.ts` - sound effects and haptics. All sounds are synthesized by `tools/make-sounds.cjs` (`npm run sounds`).
- `src/data/` - generated from the web version next door by `npm run data`: 2,000+ beaches (USGS GNIS + OpenStreetMap), 32 knowledge topics, NOAA tide stations, Natural Earth coastline.
- `tests/` - `npm test` (forecast engine, report wording, coastline checks against known places).

Every push to `main` builds on GitHub Actions and ships to TestFlight (bump `version` in `app.json` for a user-visible release).

Data: Open-Meteo.com (CC BY 4.0), NOAA NDBC and CO-OPS (public domain), USGS GNIS (public domain), OpenStreetMap contributors (ODbL), Natural Earth (public domain).
