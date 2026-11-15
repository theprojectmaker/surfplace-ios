// Converts the SurfPlace data (beaches, knowledge, tide stations, world coastline) from the
// web project next door (../surfplace) into the JSON the native app loads from src/data/.
// Run: node tools/build-data.mjs   (commit the generated files)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, '..', 'surfplace');
const out = path.join(root, 'src', 'data');
fs.mkdirSync(out, { recursive: true });
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');

// beaches-us.js + data.js + knowledge.js build BEACHES and KNOWLEDGE as plain globals
const { BEACHES, KNOWLEDGE } = new Function(read('beaches-us.js') + '\n' + read('data.js') + '\n' + read('knowledge.js') + '\n;return { BEACHES, KNOWLEDGE };')();
const TIDES = new Function(read('tide-stations.js') + '\n;return TIDE_STATIONS;')();

// [name, region, lat, lon, facing, famous?]
const beaches = BEACHES.map((b) => [b.name, b.region, b.lat, b.lon, b.facing, b.top ? 1 : 0]);
if (beaches.length < 1500) throw new Error('build-data: only ' + beaches.length + ' beaches, something is wrong');
fs.writeFileSync(path.join(out, 'beaches.json'), JSON.stringify(beaches));

// [group, title, intro | '', [lines]]
const knowledge = KNOWLEDGE.map((k) => [k.g || 'THE BASICS', k.t, k.p || '', k.l]);
fs.writeFileSync(path.join(out, 'knowledge.json'), JSON.stringify(knowledge));

fs.writeFileSync(path.join(out, 'tides.json'), JSON.stringify(TIDES));

const size = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB';
console.log('beaches ' + beaches.length + ' (' + size('beaches.json') + '), knowledge topics ' + knowledge.length +
  ', tide stations ' + TIDES.length + '');
