// Dependency-free quality gate. Usage: node scripts/check.mjs   (exit 1 on any failure)
// Checks: registry ↔ folders ↔ home ↔ _headers ↔ sitemap; generated files are up to date (no drift);
// head contract per page; CSP hashes match inline scripts; innerHTML / dangerous sinks only where
// allow-listed; no inline on*= handlers; localStorage only inside try; internal links resolve;
// vendor file hashes match assets/vendor/VERSIONS.txt.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://devtool-moya.netlify.app';
const errors = [];
const fail = (where, what) => errors.push(`${where}: ${what}`);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Reviewed HTML sinks, pinned by exact (trimmed) line text — any edit to these lines, or any new
// sink anywhere, fails the gate until re-reviewed here.
const SINK_ALLOW = new Set([
  'diagram-viewer/index.html|canvas.innerHTML = svg; // produced by mermaid.render with securityLevel \'strict\'',
  'html-viewer/index.html|frame.srcdoc = doc; // rendered only inside the sandboxed iframe (allow-scripts, no same-origin)',
  'markdown-viewer/index.html|preview.innerHTML = lastHtml; // sanitized by DOMPurify above',
]);
const SINK_RE = /\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML|createContextualFragment|document\.write(ln)?\(|\.srcdoc\s*=|setAttribute\(\s*['"`]on|set(Timeout|Interval)\(\s*['"`]/;
// Route-level CSP invariants (protect against a loosened generator)
const INLINE_OK = new Set(['html-viewer']);
const NETWORK_OK = new Set(['http-client']);

// ── registry ──
const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {} } };
vm.runInNewContext(read('assets/tools.js'), ctx);
const tools = ctx.window.DevTools.CATEGORIES.flatMap(c => c.tools);
const routes = tools.map(t => t.route);
if (new Set(routes).size !== routes.length) fail('registry', 'duplicate routes');

const dirs = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'index.html'))).map(d => d.name);
for (const r of routes) if (!dirs.includes(r)) fail('registry', `/${r} has no ${r}/index.html`);
for (const d of dirs) if (!routes.includes(d)) fail(d, 'folder with index.html is not in the registry');

const home = read('index.html'), headers = read('_headers'), sitemap = read('sitemap.xml');
for (const r of routes) {
  if (!home.includes(`href="/${r}"`)) fail('index.html', `missing card for /${r}`);
  if (!headers.includes(`\n/${r}\n`)) fail('_headers', `missing CSP block for /${r}`);
  if (!sitemap.includes(`${SITE_URL}/${r}<`)) fail('sitemap.xml', `missing /${r}`);
}

// ── generator drift: run generators on a temp copy and diff ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devtools-check-'));
try {
  fs.cpSync(ROOT, tmp, { recursive: true, filter: s => !s.includes(`${path.sep}.git`) });
  execFileSync(process.execPath, [path.join(tmp, 'scripts/json-codegen/build-gen-pages.js')], { stdio: 'ignore' });
  execFileSync(process.execPath, [path.join(tmp, 'scripts/gen-site.mjs'), tmp], { stdio: 'ignore' });
  const generated = ['index.html', '404.html', '_headers', 'netlify.toml', 'robots.txt', 'sitemap.xml',
    ...routes.map(r => `${r}/index.html`)];
  for (const f of generated) {
    const a = read(f), b = fs.readFileSync(path.join(tmp, f), 'utf8');
    if (a !== b) fail(f, 'out of date — run: node scripts/json-codegen/build-gen-pages.js && node scripts/gen-site.mjs .');
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── per-page checks ──
const pages = ['index.html', '404.html', ...routes.map(r => `${r}/index.html`)];
for (const p of pages) {
  const html = read(p);
  const route = p === 'index.html' ? '' : p === '404.html' ? null : p.split('/')[0];
  const has = (re, what) => { if (!re.test(html)) fail(p, `missing ${what}`); };
  has(/<title>[^<]{5,}<\/title>/, '<title>');
  has(/<meta name="description" content="[^"]{20,}"/, 'meta description');
  has(/<link rel="stylesheet" href="\/assets\/app.css"/, 'app.css');
  has(/<script src="\/assets\/tools.js"><\/script>/, 'tools.js');
  has(/<meta http-equiv="Content-Security-Policy"/, 'meta CSP');
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/="[^"]*"/g, '=""');
  if ((markup.match(/<h1[\s>]/g) || []).length !== 1) fail(p, 'must have exactly one <h1>');
  if (route !== null) {
    const canon = `${SITE_URL}/${route}`;
    if (!html.includes(`<link rel="canonical" href="${canon}"`)) fail(p, `canonical must be ${canon}`);
  } else if (!/noindex/.test(html)) fail(p, '404 must be noindex');
  if (/fonts\.googleapis|fonts\.gstatic/.test(html)) fail(p, 'third-party font request');
  if (/<script[^>]+src="(?!\/)/.test(html)) fail(p, 'external or relative script src');

  // CSP hash for each executable inline script must be present in the meta policy
  const meta = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || '';
    if (/\ssrc=/.test(attrs) || /application\/ld\+json/.test(attrs)) continue;
    const h = `sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}`;
    const scriptSrc = (meta.match(/script-src([^;]*)/) || [, ''])[1];
    if (!scriptSrc.includes(h) && !scriptSrc.includes("'unsafe-inline'")) fail(p, 'inline script hash not in CSP script-src — run gen-site');
  }

  // CSP invariants (meta)
  const dir = (name) => ((meta.match(new RegExp('(?:^|; )' + name + ' ([^;]*)')) || [, null])[1]);
  if (/'unsafe-inline'/.test(dir('script-src') || '') && !INLINE_OK.has(route)) fail(p, "script-src must not allow 'unsafe-inline'");
  if (dir('connect-src') !== "'none'" && !NETWORK_OK.has(route)) fail(p, "connect-src must be 'none'");
  if (dir('object-src') !== "'none'") fail(p, "object-src must be 'none'");
  if (/unsafe-eval|\*|https?:/.test(dir('script-src') || '')) fail(p, 'script-src must be self + hashes only');

  scanSinks(p, html);

  // internal links
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const u = m[1];
    if (u === '/' || u.startsWith('/assets/')) {
      if (u.startsWith('/assets/') && !fs.existsSync(path.join(ROOT, u))) fail(p, `broken asset link ${u}`);
      continue;
    }
    const seg = u.replace(/^\/|\/$/g, '');
    if (!routes.includes(seg) && !fs.existsSync(path.join(ROOT, seg))) fail(p, `broken link ${u}`);
  }
}

function scanSinks(file, src) {
  src.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (/^(\/\/|\*)/.test(t)) return;
    if (SINK_RE.test(line) && !SINK_ALLOW.has(file + '|' + t)) fail(`${file}:${i + 1}`, `unreviewed HTML/script sink: ${t.slice(0, 90)}`);
    if (/\b(eval|new Function)\s*\(/.test(line)) fail(`${file}:${i + 1}`, 'eval/new Function');
    // inline handlers in markup — including inside template literals (CSP would block them anyway, but they signal string-built HTML)
    if (/<[a-z][^>]*\son[a-z]+\s*=\s*["'`]/i.test(line) && !/placeholder=|title=/.test(line)) fail(`${file}:${i + 1}`, 'inline event handler attribute');
  });
}
for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('.js'))) scanSinks('assets/' + f, read('assets/' + f));

// _headers invariants: every CSP header line obeys the same route rules
{
  let current = null;
  for (const line of headers.split('\n')) {
    if (/^\S/.test(line)) { current = line.trim(); continue; }
    const m = line.match(/^\s+Content-Security-Policy: (.*)$/);
    if (!m) continue;
    const r = current.replace(/^\/|\/\*$|\/$/g, '');
    const d = (name) => ((m[1].match(new RegExp('(?:^|; )' + name + ' ([^;]*)')) || [, null])[1]);
    if (/'unsafe-inline'/.test(d('script-src') || '') && !INLINE_OK.has(r)) fail('_headers ' + current, "script-src must not allow 'unsafe-inline'");
    if (d('connect-src') !== "'none'" && !NETWORK_OK.has(r)) fail('_headers ' + current, "connect-src must be 'none'");
    if (d('frame-ancestors') !== "'none'") fail('_headers ' + current, "frame-ancestors must be 'none'");
    if (d('object-src') !== "'none'") fail('_headers ' + current, "object-src must be 'none'");
  }
}

// localStorage/sessionStorage access must be inside a try block (private mode throws)
for (const f of [...pages, ...fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('.js')).map(f => 'assets/' + f)]) {
  const src = read(f);
  const re = /(localStorage|sessionStorage)\.(getItem|setItem|removeItem|clear)/g;
  let m;
  while ((m = re.exec(src))) {
    const before = src.slice(Math.max(0, m.index - 400), m.index);
    const tryAt = before.lastIndexOf('try');
    const catchAt = before.lastIndexOf('catch');
    if (tryAt < 0 || catchAt > tryAt) {
      const line = src.slice(0, m.index).split('\n').length;
      fail(`${f}:${line}`, `${m[1]} access not inside try`);
    }
  }
}

// vendor hashes
const versions = read('assets/vendor/VERSIONS.txt').split('\n').filter(l => l && !l.startsWith('#'));
for (const l of versions) {
  const [file, , , sha] = l.split('|').map(s => s.trim());
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'assets/vendor', file))).digest('hex');
  if (actual !== sha) fail(`assets/vendor/${file}`, 'sha256 does not match VERSIONS.txt');
}

if (errors.length) {
  console.error(errors.map(e => '✗ ' + e).join('\n'));
  console.error(`\n${errors.length} problem(s).`);
  process.exit(1);
}
console.log(`✓ ${pages.length} pages, ${routes.length} tools, ${versions.length} vendor files — all checks passed.`);
