// Copies only the public site into dist/ — Netlify publishes that folder, so repository files
// (scripts/, docs/, README.md, LICENSE, netlify.toml …) are never deployed in any letter case.
// Allow-list, not deny-list: a new top-level file stays private until it is added here.
// Usage: node scripts/build-dist.mjs   (Netlify build: node scripts/check.mjs && node scripts/build-dist.mjs)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {} } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/tools.js'), 'utf8'), ctx);
const routes = ctx.window.DevTools.CATEGORIES.flatMap(c => c.tools.map(t => t.route));

const PUBLIC = ['index.html', '404.html', '_headers', 'sitemap.xml', 'robots.txt', 'assets', ...routes];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);
for (const entry of PUBLIC) {
  const src = path.join(ROOT, entry);
  if (!fs.existsSync(src)) { console.error(`build-dist: missing ${entry}`); process.exit(1); }
  fs.cpSync(src, path.join(DIST, entry), { recursive: true, filter: s => !path.basename(s).startsWith('.') });
}
console.log(`dist/: ${PUBLIC.length} entries (${routes.length} tools)`);
