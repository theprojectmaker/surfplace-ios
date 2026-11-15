// Exports the app as a static website (the same code as the phone app, run in a browser).
//   node scripts/build-web.mjs <output folder> [base path]      e.g.  ... ../surfplace-web /surfplace-web
// The folder's .git (if any) is kept; everything else in it is replaced.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || '');
// accept surfplace-web or /surfplace-web (a shell on Windows can rewrite a leading slash into a drive path)
const baseArg = (process.argv[3] || '').split('\\').join('/');
const trimmed = baseArg.split('/').filter(Boolean).join('/');
const base = /^[A-Za-z]:/.test(baseArg) || !trimmed ? '' : '/' + trimmed;
if (!process.argv[2]) { console.error('usage: node scripts/build-web.mjs <output folder> [base path]'); process.exit(1); }

const appJson = path.join(root, 'app.json');
const original = fs.readFileSync(appJson, 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-web-'));
try {
  // the base path (for hosting under /something/) lives in app.json while the export runs
  const cfg = JSON.parse(original);
  cfg.expo.experiments = { ...(cfg.expo.experiments || {}), baseUrl: base };
  fs.writeFileSync(appJson, JSON.stringify(cfg, null, 2) + '\n');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', tmp], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
} finally {
  fs.writeFileSync(appJson, original); // always put app.json back
}

fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f !== '.git') fs.rmSync(path.join(out, f), { recursive: true, force: true });
fs.cpSync(tmp, out, { recursive: true });
fs.writeFileSync(path.join(out, '.nojekyll'), ''); // GitHub Pages must serve the _expo folder
fs.copyFileSync(path.join(out, 'index.html'), path.join(out, '404.html'));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Website written to ' + out + (base ? ' (base path ' + base + ')' : ''));
