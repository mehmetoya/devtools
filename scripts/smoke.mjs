// Post-deploy smoke test against a live URL (production or a Netlify deploy preview). Dependency-free.
// Usage: node scripts/smoke.mjs https://tool.mehmetoya.com      (exit 1 on any failure)
// Checks: every route answers 200 without a redirect; CSP header present and obeys the route rules
// (hash-only script-src except /html-viewer, connect-src 'none' except /http-client); the header
// policy equals the page's <meta> policy; unknown paths 404 with a meta CSP; repository files are
// not served; shared assets, fonts, vendor files, sitemap and robots load.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || '').replace(/\/$/, '');
if (!/^https?:\/\//.test(BASE)) { console.error('usage: node scripts/smoke.mjs <base-url>'); process.exit(2); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {} } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/tools.js'), 'utf8'), ctx);
const routes = ctx.window.DevTools.CATEGORIES.flatMap(c => c.tools.map(t => t.route));

const errors = [];
const fail = (where, what) => errors.push(`${where}: ${what}`);
const get = (p) => fetch(BASE + p, { redirect: 'manual', headers: { 'user-agent': 'devtools-smoke' } });
const dir = (policy, name) => ((policy.match(new RegExp('(?:^|; )' + name + ' ([^;]*)')) || [, null])[1]);

async function page(p, route, expectStatus = 200) {
  const res = await get(p);
  if (res.status !== expectStatus) return fail(p, `status ${res.status}, expected ${expectStatus}${res.headers.get('location') ? ' → ' + res.headers.get('location') : ''}`);
  const html = await res.text();
  const meta = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
  if (!meta) fail(p, 'no <meta> CSP');
  if (expectStatus !== 200) return;
  const header = res.headers.get('content-security-policy');
  if (!header) return fail(p, 'no Content-Security-Policy header');
  if (header.includes(',')) fail(p, 'several CSP policies merged into one header (overlapping _headers rules)');
  if (/'unsafe-inline'/.test(dir(header, 'script-src') || '') && route !== 'html-viewer') fail(p, "script-src allows 'unsafe-inline'");
  if (dir(header, 'connect-src') !== "'none'" && route !== 'http-client') fail(p, "connect-src is not 'none'");
  if (dir(header, 'frame-ancestors') !== "'none'") fail(p, "frame-ancestors is not 'none'");
  if (meta && meta !== header.replace(/ ?frame-ancestors [^;]*;/, '')) fail(p, 'header CSP and meta CSP differ (stale deploy or cache?)');
  if (res.headers.get('x-frame-options') !== 'DENY') fail(p, 'X-Frame-Options is not DENY');
}

await page('/', '');
for (const r of routes) {
  await page('/' + r, r);
  await page('/' + r + '/', r);
}
await page('/this-page-does-not-exist', null, 404);

for (const p of ['/README.md', '/LICENSE', '/netlify.toml', '/_headers', '/scripts/check.mjs', '/scripts/gen-site.mjs', '/docs/specs/ui-redesign.md',
  '/Scripts/gen-site.mjs', '/Readme.md', '/README.MD', '/Docs/specs/ui-redesign.md', '/License', '/Netlify.toml', '/.git/config']) {
  const res = await get(p);
  if (res.status !== 404) fail(p, `repository file served (status ${res.status})`);
}
for (const p of ['/assets/tools.js', '/assets/app.css', '/assets/regex-worker.js', '/assets/favicon.svg',
  '/assets/fonts/ibm-plex-sans-condensed-latin-600-normal.woff2', '/assets/fonts/ibm-plex-sans-latin-400-normal.woff2', '/assets/fonts/ibm-plex-mono-latin-400-normal.woff2',
  '/assets/vendor/mermaid.min.js', '/assets/vendor/purify.min.js', '/sitemap.xml', '/robots.txt',
  '/favicon.ico', '/apple-touch-icon.png', '/manifest.webmanifest', '/llms.txt', '/.well-known/security.txt',
  '/assets/og/home.png', '/assets/og/base64.png', '/assets/icons/icon-512.png']) {
  const res = await get(p);
  if (res.status !== 200) fail(p, `status ${res.status}`);
}

if (errors.length) {
  console.error(errors.map(e => '✗ ' + e).join('\n'));
  console.error(`\n${errors.length} problem(s) on ${BASE}`);
  process.exit(1);
}
console.log(`✓ ${BASE}: ${routes.length * 2 + 1} pages, 404 page, repo files hidden, assets — all smoke checks passed.`);
