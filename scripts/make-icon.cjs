// Draws the SurfPlace pixel-wave icon. No image libraries: raw pixels -> PNG via zlib.
// Run: node scripts/make-icon.cjs
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const table = [];
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// pixels: array of [r,g,b,a]; alpha=false writes an opaque RGB file (App Store icons must have no alpha)
function png(file, size, at, alpha) {
  const bpp = alpha ? 4 : 3;
  const raw = Buffer.alloc((size * bpp + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * bpp + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const p = at(x, y), o = y * (size * bpp + 1) + 1 + x * bpp;
      raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2];
      if (alpha) raw[o + 3] = p[3];
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0); head.writeUInt32BE(size, 4);
  head[8] = 8; head[9] = alpha ? 6 : 2;
  fs.writeFileSync(path.join(OUT, file), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
  console.log('wrote assets/' + file);
}

// the same 16x16 wave as the app's header logo
const ART = [
  '................', '................', '.....wwww.......', '...wwbbbbww.....',
  '..wbbbbbbbbw....', '.wbbbddddbbbw...', '.wbbd....dbbw...', 'wbbd......dbw...',
  'wbbd.......ww...', 'wbbbd...........', 'wbbbbd..........', 'wbbbbbdd......ww',
  'bbbbbbbbddddwwbb', 'bbbbbbbbbbbbbbbb', 'dbbbbbbbbbbbbbbd', 'dddddddddddddddd',
];
const COL = { w: [255, 255, 255, 255], b: [30, 155, 215, 255], d: [20, 121, 184, 255] };
const SUN = [255, 210, 63, 255];

// app icon: the wave on a sun-yellow square, with a small margin so iOS rounding does not clip it
png('icon.png', 1024, (x, y) => {
  const cell = 56, off = (1024 - 16 * cell) / 2;
  const cx = Math.floor((x - off) / cell), cy = Math.floor((y - off) / cell);
  if (cy > 15) return COL.d;
  if (cy >= 12) return COL[ART[cy][Math.min(15, Math.max(0, cx))]] || COL.b; // the sea runs edge to edge
  if (cx < 0 || cx > 15 || cy < 0) return SUN;
  return COL[ART[cy][cx]] || SUN;
}, false);

// splash mark: just the wave, transparent around it (the splash background is blue, so outline in white)
png('splash-icon.png', 512, (x, y) => {
  const cell = 32, cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  const ch = ART[cy][cx];
  if (ch === 'w') return COL.w;
  if (ch === 'b' || ch === 'd') return [255, 210, 63, 255];
  return [0, 0, 0, 0];
}, true);
