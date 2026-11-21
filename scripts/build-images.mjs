// Renders the site's raster images with local Chrome over the DevTools Protocol (no npm dependencies):
//   assets/og/<route>.png, assets/og/home.png   1200×630 social cards (Open Graph / Twitter)
//   assets/icons/icon-{180,192,512}.png, icon-maskable-512.png, apple-touch-icon.png, favicon.ico
// Run after changing a tool's name/description or the brand: node scripts/build-images.mjs
// (Netlify has no Chrome, so the PNGs are committed; scripts/check.mjs verifies they exist and their sizes.)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {} } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/tools.js'), 'utf8'), ctx);
const D = ctx.window.DevTools;
const tools = D.allTools();
const rev = tools.map(t => t.rev).sort().pop();

const font = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'assets/fonts', file)).toString('base64')}`;
const FONTS = `
@font-face { font-family: C; font-weight: 600; src: url(${font('ibm-plex-sans-condensed-latin-600-normal.woff2')}) format('woff2'); }
@font-face { font-family: S; font-weight: 400; src: url(${font('ibm-plex-sans-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: M; font-weight: 400; src: url(${font('ibm-plex-mono-latin-400-normal.woff2')}) format('woff2'); }`;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function card({ kicker, title, desc, sheet }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0e1318; color: #dbe3ea; font-family: M;
    background-image: linear-gradient(rgba(150,180,210,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(150,180,210,.10) 1px, transparent 1px),
      linear-gradient(rgba(150,180,210,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(150,180,210,.045) 1px, transparent 1px);
    background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px; }
  .frame { position: absolute; inset: 40px; border: 2px solid #3a4756; background: rgba(14,19,24,.82); }
  .frame::before, .frame::after { content: ''; position: absolute; width: 36px; height: 36px; border: 0 solid #ff7a45; }
  .frame::before { top: -2px; left: -2px; border-width: 6px 0 0 6px; } .frame::after { bottom: -2px; right: -2px; border-width: 0 6px 6px 0; }
  .body { position: absolute; left: 64px; right: 64px; top: 56px; }
  .kicker { font-family: C; font-weight: 600; font-size: 22px; letter-spacing: .16em; text-transform: uppercase; color: #8796a5; }
  h1 { margin-top: 18px; font-family: C; font-weight: 600; font-size: ${title.length > 22 ? 72 : 92}px; line-height: 1.02; letter-spacing: .02em; text-transform: uppercase; color: #dbe3ea; max-width: 1000px; }
  h1 em { font-style: normal; color: #ff7a45; }
  p { margin-top: 22px; font-family: S; font-size: 30px; line-height: 1.4; color: #a3b0bd; max-width: 960px; }
  .tb { position: absolute; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: 1.4fr 1fr 1fr; border-top: 2px solid #3a4756; }
  .tb div { padding: 14px 22px; border-right: 2px solid #3a4756; } .tb div:last-child { border-right: 0; }
  .tb span { display: block; font-family: C; font-weight: 600; font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: #8796a5; }
  .tb b { display: block; margin-top: 4px; font-family: C; font-weight: 600; font-size: 26px; letter-spacing: .06em; text-transform: uppercase; color: #dbe3ea; }
  .tb .sig b { color: #ff7a45; }
  </style></head><body><div class="frame">
    <div class="body"><div class="kicker">${esc(kicker)}</div><h1>${title}</h1><p>${esc(desc)}</p></div>
    <div class="tb"><div><span>Site</span><b>tool.mehmetoya.com</b></div><div><span>Sheet</span><b>${esc(sheet)}</b></div><div class="sig"><span>Drawn by</span><b>Mehmet Oya</b></div></div>
  </div></body></html>`;
}
const iconHtml = (size, maskable) => `<!doctype html><html><head><style>* { margin: 0; } body { width: ${size}px; height: ${size}px; background: #0e1318; overflow: hidden; }
  img { display: block; width: ${maskable ? size * 0.7 : size}px; height: ${maskable ? size * 0.7 : size}px; margin: ${maskable ? size * 0.15 : 0}px; }</style></head>
  <body><img src="data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, 'assets/favicon.svg')).toString('base64')}"></body></html>`;

// ── Chrome over CDP ──
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'devtools-img-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const cleanup = () => { if (chrome.exitCode === null) chrome.kill(); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp */ } };
process.on('exit', cleanup);
const wsUrl = await new Promise((res, rej) => { let b = ''; chrome.stderr.on('data', d => { b += d; const m = b.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); }); setTimeout(() => rej(new Error('Chrome did not start')), 15000); });
const ws = new WebSocket(wsUrl); await new Promise(r => { ws.onopen = r; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId && { sessionId }) })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);

async function render(html, w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId);
  const { frameTree } = await send('Page.getFrameTree', {}, sessionId);
  await send('Page.setDocumentContent', { frameId: frameTree.frame.id, html }, sessionId);
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode ? i.decode() : 0)))', awaitPromise: true }, sessionId);
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }, sessionId);
  return Buffer.from(data, 'base64');
}
const write = (rel, buf) => { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };

// social cards
write('assets/og/home.png', await render(card({ kicker: `Drawing set · ${tools.length} sheets · rev. ${rev}`, title: 'Developer tools that <em>never see your data</em>.', desc: `${tools.length} private, client-side utilities for JSON, encoding, hashes, JWT, regex and more. No backend, no tracking.`, sheet: `${tools.length} sheets` }), 1200, 630));
for (const [i, t] of tools.entries()) {
  const n = String(i + 1).padStart(2, '0');
  write(`assets/og/${t.route}.png`, await render(card({ kicker: `${t.category} · sheet ${n} / ${tools.length}`, title: esc(t.name), desc: t.desc + ' Runs in your browser.', sheet: `${n} / ${tools.length}` }), 1200, 630));
}
// icons
const pngs = {};
for (const s of [16, 32, 48, 180, 192, 512]) pngs[s] = await render(iconHtml(s, false), s, s);
write('assets/icons/icon-192.png', pngs[192]);
write('assets/icons/icon-512.png', pngs[512]);
write('assets/icons/icon-maskable-512.png', await render(iconHtml(512, true), 512, 512));
write('apple-touch-icon.png', pngs[180]);
// favicon.ico with embedded PNGs (16, 32, 48)
{
  const sizes = [16, 32, 48];
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const b = pngs[s], o = 6 + 16 * i;
    head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(b.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += b.length;
  });
  write('favicon.ico', Buffer.concat([head, ...sizes.map(s => pngs[s])]));
}
ws.close(); cleanup();
console.log(`images: ${tools.length + 1} social cards, 5 icons, favicon.ico`);
