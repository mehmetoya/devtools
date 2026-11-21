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

const PUBLIC = ['index.html', '404.html', '_headers', 'sitemap.xml', 'robots.txt', 'manifest.webmanifest', 'llms.txt', 'llms-full.txt',
  'favicon.ico', 'apple-touch-icon.png', '.well-known', 'assets', ...routes];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);
for (const entry of PUBLIC) {
  const src = path.join(ROOT, entry);
  if (!fs.existsSync(src)) { console.error(`build-dist: missing ${entry}`); process.exit(1); }
  // skip OS/VCS junk only; deliberate dotfiles such as .well-known/ would be copied
  fs.cpSync(src, path.join(DIST, entry), { recursive: true, filter: s => !/^(\.DS_Store|\.git.*)$/.test(path.basename(s)) });
}

// ── verify the output: nothing private, nothing missing ──
const problems = [];
const PRIVATE = /^(readme(\.md)?|license|netlify\.toml|scripts|docs|dist|\.git.*|\.github|package(-lock)?\.json)$/i;
for (const name of fs.readdirSync(DIST)) if (PRIVATE.test(name)) problems.push(`private entry published: ${name}`);
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const files = walk(DIST);
for (const f of files.filter(f => /\.(html|css|js)$/.test(f))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/["'(](\/assets\/[^"'()\s?#`$]+)/g)) {
    if (!fs.existsSync(path.join(DIST, m[1]))) problems.push(`${path.relative(DIST, f)} references missing ${m[1]}`);
  }
}
for (const r of routes) if (!fs.existsSync(path.join(DIST, r, 'index.html'))) problems.push(`missing /${r}/index.html`);
if (problems.length) { console.error(problems.map(p => '✗ ' + p).join('\n')); process.exit(1); }
console.log(`dist/: ${PUBLIC.length} entries, ${files.length} files (${routes.length} tools) — verified`);
