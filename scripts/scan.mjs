// Browser scan of every page via the Chrome DevTools Protocol. Dependency-free (Node ≥22 + local Chrome).
// Usage: node scripts/scan.mjs [base=http://127.0.0.1:8888] [--widths=375,1280] [--json]
//        CHROME_PATH=/path/to/chrome overrides the browser binary.
// Per page and width it reports: CSP violations, console errors, uncaught exceptions, failed or
// third-party requests, unexpected HTTP status, and horizontal overflow. It also measures font bytes
// downloaded on the first load of the home page. Exit 1 on any problem.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const BASE = (args.find(a => !a.startsWith('--')) || 'http://127.0.0.1:8888').replace(/\/$/, '');
const WIDTHS = ((args.find(a => a.startsWith('--widths=')) || '--widths=375,1280').split('=')[1]).split(',').map(Number);
const JSON_OUT = args.includes('--json');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = new URL(BASE).origin;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {} } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/tools.js'), 'utf8'), ctx);
const routes = ctx.window.DevTools.CATEGORIES.flatMap(c => c.tools.map(t => t.route));
const PAGES = [['/', 200], ...routes.map(r => ['/' + r, 200]), ['/this-page-does-not-exist', 404]];

// ── launch Chrome and connect ──
if (!fs.existsSync(CHROME)) { console.error(`Chrome not found at ${CHROME} (set CHROME_PATH)`); process.exit(2); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'devtools-scan-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const t = setTimeout(() => reject(new Error('Chrome did not start')), 15000);
  chrome.stderr.on('data', d => {
    buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  chrome.on('exit', c => reject(new Error('Chrome exited with ' + c)));
});
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 0; const pending = new Map(); const listeners = new Set();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) for (const l of listeners) l(msg);
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
});

// ── scan one page ──
async function scan(pathname, expectStatus, width) {
  const issues = []; const fontBytes = new Map(); const inflight = new Set(); const types = new Map();
  let status = null; let loaded = false; let lastActivity = Date.now(); let fontsBeforeInteraction = 0, fontFilesBefore = 0;
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const on = (msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params;
    switch (msg.method) {
      case 'Runtime.consoleAPICalled':
        if (p.type === 'error') issues.push('console: ' + p.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 240));
        break;
      case 'Runtime.exceptionThrown':
        issues.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0].slice(0, 240));
        break;
      case 'Log.entryAdded':
        if (p.entry.level === 'error' && p.entry.source !== 'network') issues.push(`${p.entry.source}: ${p.entry.text.slice(0, 240)}`);
        break;
      case 'Network.requestWillBeSent': {
        inflight.add(p.requestId); lastActivity = Date.now();
        const u = p.request.url;
        if (!/^(data|blob|about):/.test(u) && new URL(u).origin !== ORIGIN) issues.push('third-party request: ' + u);
        break;
      }
      case 'Network.responseReceived':
        types.set(p.requestId, p.type);
        if (p.type === 'Document' && status === null) status = p.response.status;
        else if (p.response.status >= 400) issues.push(`HTTP ${p.response.status}: ${p.response.url}`);
        break;
      case 'Network.loadingFinished':
        inflight.delete(p.requestId); lastActivity = Date.now();
        if (types.get(p.requestId) === 'Font') fontBytes.set(p.requestId, p.encodedDataLength);
        break;
      case 'Network.loadingFailed':
        inflight.delete(p.requestId); lastActivity = Date.now();
        if (!p.canceled) issues.push('request failed: ' + p.errorText);
        break;
      case 'Page.loadEventFired': loaded = true; break;
    }
  };
  listeners.add(on);
  try {
    await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable'].map(m => send(m, {}, sessionId)));
    await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', { source:
      "document.addEventListener('securitypolicyviolation', e => console.error('CSP violation: ' + e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sample || '')));" }, sessionId);
    await send('Page.navigate', { url: BASE + pathname }, sessionId);
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !(loaded && inflight.size === 0 && Date.now() - lastActivity > 400)) await new Promise(r => setTimeout(r, 50));
    if (!loaded) issues.push('load event did not fire within 15s');
    if (status !== expectStatus) issues.push(`status ${status}, expected ${expectStatus}`);
    const { result } = await send('Runtime.evaluate', { expression:
      'JSON.stringify({ sw: document.documentElement.scrollWidth, w: window.innerWidth })', returnByValue: true }, sessionId);
    const { sw, w } = JSON.parse(result.value);
    if (sw > w + 1) issues.push(`horizontal overflow: scrollWidth ${sw} > viewport ${w}`);

    fontsBeforeInteraction = [...fontBytes.values()].reduce((x, y) => x + y, 0); fontFilesBefore = fontBytes.size;
    // command palette: "/" opens it with focus in the search field; Esc closes it and focus returns to the opener
    if (expectStatus === 200) {
      const key = (k, code, keyCode, text) => Promise.all(['keyDown', 'keyUp'].map((type, i) => new Promise(r => setTimeout(r, i * 20)).then(() =>
        send('Input.dispatchKeyEvent', { type: type === 'keyDown' && text ? 'keyDown' : type, key: k, code, windowsVirtualKeyCode: keyCode, ...(type === 'keyDown' && text ? { text } : {}) }, sessionId))));
      const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result.value;
      await evalJs("document.querySelector('.find-btn') && document.querySelector('.find-btn').focus()");
      await key('/', 'Slash', 191, '/');
      await new Promise(r => setTimeout(r, 120));
      const opened = await evalJs("({ open: !!document.querySelector('dialog.palette[open]'), focus: document.activeElement && document.activeElement.className, options: document.querySelectorAll('.pal-list [role=option]').length })");
      if (!opened || !opened.open) issues.push('palette: "/" did not open the palette');
      else {
        if (opened.focus !== 'pal-input') issues.push('palette: focus is not in the search field after opening');
        if (opened.options !== routes.length) issues.push(`palette: empty query lists ${opened.options} tools, expected ${routes.length}`);
        await key('Escape', 'Escape', 27);
        await new Promise(r => setTimeout(r, 120));
        const closed = await evalJs("({ open: !!document.querySelector('dialog.palette[open]'), focus: document.activeElement && document.activeElement.className })");
        if (closed.open) issues.push('palette: Esc did not close the palette');
        else if (closed.focus !== 'find-btn') issues.push(`palette: focus did not return to the opener (got "${closed.focus}")`);
      }
    }
  } finally {
    listeners.delete(on);
    await send('Target.closeTarget', { targetId }).catch(() => {});
  }
  return { page: pathname, width, issues: [...new Set(issues)], fontBytes: fontsBeforeInteraction, fontFiles: fontFilesBefore };
}

const results = [];
try {
  for (const width of WIDTHS) for (const [p, s] of PAGES) results.push(await scan(p, s, width));
} finally {
  ws.close();
  const exited = new Promise(r => chrome.once('exit', r));
  chrome.kill();
  await Promise.race([exited, new Promise(r => setTimeout(r, 5000))]);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp profile; OS cleans up */ }
}

const bad = results.filter(r => r.issues.length);
const home = results.find(r => r.page === '/' && r.width === Math.max(...WIDTHS));
if (JSON_OUT) console.log(JSON.stringify({ base: BASE, results, homeFontBytes: home?.fontBytes, homeFontFiles: home?.fontFiles }, null, 2));
else {
  for (const r of bad) console.error(`✗ ${r.page} @${r.width}px\n  ` + r.issues.join('\n  '));
  console.log(`home first load: ${home?.fontFiles} font files, ${home?.fontBytes} bytes`);
}
if (bad.length) { console.error(`\n${bad.length} page/width combination(s) with problems on ${BASE}`); process.exit(1); }
console.log(`✓ ${BASE}: ${PAGES.length} pages × ${WIDTHS.join('/')}px — no CSP violations, errors, third-party requests or overflow.`);
