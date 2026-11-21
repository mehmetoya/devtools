// Local Netlify-like static server for previews and scans. Dependency-free.
// Usage: node scripts/serve.mjs [root=.] [port=8888]     (binds 127.0.0.1 only)
// Mimics what matters for this site: /<route> and /<route>/ serve <route>/index.html, _headers rules
// (incl. the per-path CSP) are applied, forced 404 redirects from netlify.toml hide repository files,
// and unknown paths get /404.html with status 404. Not a production server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8888);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.md': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

const glob = (pat, flags) => new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', flags);

function headerRules() {
  const rules = []; let cur = null;
  for (const line of fs.readFileSync(path.join(root, '_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { re: glob(line.trim()), h: [] }; rules.push(cur); continue; }
    const i = line.indexOf(':');
    if (cur && i > 0) cur.h.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return rules;
}

// forced 404 redirects (repository files) from netlify.toml — next to the served folder, else the repo root
const TOML = [path.join(root, 'netlify.toml'), path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'netlify.toml')].find(f => fs.existsSync(f));
function hiddenRules() {
  if (!TOML) return [];
  const toml = fs.readFileSync(TOML, 'utf8');
  return toml.split('[[redirects]]').slice(1)
    .filter(b => /status\s*=\s*404/.test(b) && /force\s*=\s*true/.test(b))
    .map(b => (b.match(/from\s*=\s*"([^"]+)"/) || [])[1]).filter(f => f && f.startsWith('/')).map(f => glob(f, 'i'));
}

// Resolve a URL path to a file strictly inside root; null if it escapes or does not exist.
function resolve(urlPath) {
  const file = path.resolve(root, '.' + urlPath);
  const rel = path.relative(root, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    const index = path.join(file, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

const HOSTS = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);

http.createServer((req, res) => {
  // DNS-rebinding guard: only answer requests addressed to this machine
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) { res.writeHead(403); return res.end('forbidden host'); }
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('bad request'); }
  if (p.includes('\0')) { res.writeHead(400); return res.end('bad request'); }
  // normalise before matching hidden rules: /a/../README.md, /README.md/ and dot-folders (.git) included
  p = path.posix.normalize(p).replace(/(.)\/+$/, '$1');
  const dotted = p.split('/').some(seg => seg.startsWith('.') && seg !== '.well-known');

  const hidden = dotted || hiddenRules().some(re => re.test(p));
  let file = hidden ? null : resolve(p);
  let status = 200;
  if (!file) { file = path.join(root, '404.html'); status = 404; }

  const headers = {};
  for (const r of headerRules()) if (r.re.test(p)) for (const [k, v] of r.h) headers[k] = headers[k] ? headers[k] + ', ' + v : v;
  headers['Content-Type'] = TYPES[path.extname(file)] || 'application/octet-stream';
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
