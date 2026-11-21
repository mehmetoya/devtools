/* ── DevTools shared shell ──
 * Tool registry, header, sidebar navigation (search + favorites) and small DOM helpers.
 * Security rule: user-supplied data is only ever written with textContent / value — never innerHTML.
 */
(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'text', name: 'Text Operations', tools: [
      { route: 'case-converter',  name: 'Case Converter',     desc: 'camelCase, snake_case, PascalCase, kebab-case and more.', aliases: ['camel', 'snake', 'kebab', 'pascal', 'upper', 'lower'], rev: '2026.11.21' },
      { route: 'reverse',         name: 'String Reverse',     desc: 'Reverse strings, lines, words or each word.', aliases: ['rev', 'backwards'], rev: '2026.11.21' },
      { route: 'trim-pad',        name: 'Trim / Pad',         desc: 'Trim whitespace or pad text to a width.', aliases: ['trim', 'pad', 'whitespace'], rev: '2026.11.21' },
      { route: 'line-counter',    name: 'Line Counter',       desc: 'Lines, words, characters, bytes and more.', aliases: ['count', 'wc', 'words', 'chars'], rev: '2026.11.21' },
      { route: 'line-operations', name: 'Line Operations',    desc: 'Sort, dedupe, filter, number, join lines.', aliases: ['sort', 'dedupe', 'unique', 'lines'], rev: '2026.11.21' },
      { route: 'compare',         name: 'String Compare',     desc: 'Compare two strings line by line.', aliases: ['diff', 'text diff'], rev: '2026.11.21' },
    ]},
    { id: 'encode', name: 'Encode / Decode', tools: [
      { route: 'base64',          name: 'Base64',             desc: 'Encode and decode Base64 (UTF-8, ASCII, UTF-16, UTF-32).', aliases: ['b64', 'atob', 'btoa'], rev: '2026.11.21' },
      { route: 'url-encode',      name: 'URL Encode',         desc: 'Percent-encode or decode URL strings.', aliases: ['url', 'percent', 'uri'], rev: '2026.11.21' },
      { route: 'hash-generator',  name: 'Hash Generator',     desc: 'MD5, SHA-1, SHA-256, SHA-384, SHA-512 + verify.', aliases: ['md5', 'sha', 'sha256', 'checksum'], rev: '2026.11.21' },
      { route: 'jwt-tool',        name: 'JWT Tool',           desc: 'Generate, decode and validate JSON Web Tokens.', aliases: ['jwt', 'token', 'bearer'], rev: '2026.11.21' },
    ]},
    { id: 'json', name: 'JSON Tools', tools: [
      { route: 'json-formatter',     name: 'JSON Formatter',  desc: 'Validate, beautify, minify, sort keys.', aliases: ['json', 'pretty', 'beautify', 'minify'], rev: '2026.11.21' },
      { route: 'json-compare',       name: 'JSON Compare',    desc: 'Structural diff of two JSON documents.', aliases: ['jdiff', 'json diff'], rev: '2026.11.21' },
      { route: 'json-to-csharp',     name: 'JSON to C#',      desc: 'Generate C# classes or records from JSON.', aliases: ['c#', 'cs', 'csharp', 'dotnet'], rev: '2026.11.21' },
      { route: 'json-to-java',       name: 'JSON to Java',    desc: 'Generate Java POJOs / records from JSON.', aliases: ['java', 'pojo'], rev: '2026.11.21' },
      { route: 'json-to-typescript', name: 'JSON to TypeScript', desc: 'Generate TypeScript interfaces / types.', aliases: ['ts', 'typescript', 'interface'], rev: '2026.11.21' },
    ]},
    { id: 'regex', name: 'Regex Tools', tools: [
      { route: 'regex-search',    name: 'Regex Search',       desc: 'Find matches and capture groups.', aliases: ['regex', 'regexp', 'match'], rev: '2026.11.21' },
      { route: 'regex-replace',   name: 'Regex Replace',      desc: 'Find and replace with group references.', aliases: ['replace', 'sub'], rev: '2026.11.21' },
      { route: 'extract',         name: 'String Extract',     desc: 'Extract by position, delimiters, regex or line range.', aliases: ['substring', 'slice', 'between'], rev: '2026.11.21' },
    ]},
    { id: 'dev', name: 'Developer Tools', tools: [
      { route: 'datetime-formatter', name: 'DateTime Formatter', desc: '.NET-style date/time format strings.', aliases: ['date', 'time', 'datetime'], rev: '2026.11.21' },
      { route: 'string-formatter',   name: 'String Formatter',   desc: 'Numeric formats, padding, composite formatting.', aliases: ['format', 'printf', 'numeric'], rev: '2026.11.21' },
      { route: 'guid-generator',     name: 'GUID Generator',     desc: 'Generate and parse GUIDs / UUIDs.', aliases: ['guid', 'uuid'], rev: '2026.11.21' },
      { route: 'password-generator', name: 'Password Generator', desc: 'Secure passwords with custom rules.', aliases: ['password', 'pwd', 'secret'], rev: '2026.11.21' },
      { route: 'number-converter',   name: 'Number Converter',   desc: 'Binary, decimal, hexadecimal, octal.', aliases: ['hex', 'binary', 'octal', 'radix'], rev: '2026.11.21' },
      { route: 'barcode-generator',  name: 'Barcode Generator',  desc: 'QR codes, EAN-13 and EAN-8 barcodes.', aliases: ['qr', 'ean', 'barcode'], rev: '2026.11.21' },
      { route: 'http-client',        name: 'HTTP Client',        desc: 'Build and send HTTP requests.', aliases: ['http', 'curl', 'rest', 'api', 'fetch'], rev: '2026.11.21' },
    ]},
    { id: 'viewers', name: 'Viewers', tools: [
      { route: 'markdown-viewer',  name: 'Markdown Viewer',     desc: 'Live Markdown preview and export.', aliases: ['md', 'markdown'], rev: '2026.11.21' },
      { route: 'html-viewer',      name: 'HTML Viewer',         desc: 'Sandboxed live HTML preview.', aliases: ['html', 'preview'], rev: '2026.11.21' },
      { route: 'diagram-viewer',   name: 'Diagram Viewer',      desc: 'Mermaid diagrams to SVG / PNG.', aliases: ['mermaid', 'diagram', 'chart'], rev: '2026.11.21' },
    ]},
  ];

  const FAV_KEY = 'devtools:favorites';

  // ── storage (never required for the page to work) ──
  function readFavs() {
    try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string'))].slice(0, 64) : []; }
    catch { return []; }
  }
  function writeFavs(list) { try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch { /* ignore */ } }

  // ── DOM helpers ──
  /** el('div', {class:'x', onclick: fn}, child1, 'text', ...) — strings become text nodes. */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return node;
  }
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function debounce(fn, ms) {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms == null ? 150 : ms); };
  }

  async function copy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text;
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
      btn.classList.toggle('ok', ok);
      setTimeout(() => { btn.textContent = prev; btn.classList.remove('ok'); }, 1200);
    }
    announce(ok ? 'Copied to clipboard' : 'Copy failed');
    return ok;
  }

  /** Announce a short message to screen readers via a shared polite live region. */
  let liveRegion = null;
  function announce(text) {
    if (!liveRegion) {
      liveRegion = el('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = '';
    setTimeout(() => { liveRegion.textContent = text; }, 30);
  }

  /** Mark a form control as invalid (red border + aria-invalid) or clear it. */
  function invalid(node, isInvalid) {
    if (!node) return;
    if (isInvalid) {
      node.setAttribute('aria-invalid', 'true');
      // point the field at the visible error message so returning to it explains why;
      // pages may set the message right after calling invalid(), so look again on the next tick
      const link = () => {
        if (node.getAttribute('aria-invalid') !== 'true') return false;
        const err = $$('.msg.msg-error').find(m => !m.hidden && m.textContent);
        if (!err) return false;
        if (!err.id) err.id = 'msg-' + Math.random().toString(36).slice(2, 8);
        node.setAttribute('aria-describedby', err.id);
        return true;
      };
      if (!link()) setTimeout(link, 0);
    } else {
      node.removeAttribute('aria-invalid');
      const d = node.getAttribute('aria-describedby');
      if (d && d.startsWith('msg-')) node.removeAttribute('aria-describedby');
    }
  }

  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Show a status message in a .msg element. kind: 'ok' | 'error' | 'warn' | 'info' | '' (hide) */
  function msg(node, kind, text) {
    if (!node) return;
    node.className = 'msg' + (kind ? ' msg-' + kind : '');
    node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    // app.css draws the status glyph (.msg-*::before); drop a glyph the caller already put in the text
    node.textContent = kind ? String(text || '').replace(/^\s*[✓✔✕✗⚠ℹ]\uFE0F?\s+/, '') : (text || '');
    node.hidden = !kind || !text;
  }

  function allTools() { return CATEGORIES.flatMap(c => c.tools.map(t => Object.assign({ category: c.name }, t))); }

  // ── tool search (pure; scripts/check.mjs runs it in a vm to prove every tool is reachable) ──
  /** Lower-case, strip accents (dönüştür → donustur) and fold Turkish dotless ı. */
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().trim();
  }
  /** Score one query token against a tool; 0 = no match. Name/alias/route prefixes beat substring matches. */
  function tokenScore(tok, t) {
    const name = norm(t.name), route = norm(t.route), aliases = (t.aliases || []).map(norm);
    const words = name.split(/[^a-z0-9#+]+/).filter(Boolean);
    if (aliases.includes(tok)) return 100;
    if (name.startsWith(tok)) return 95;
    if (route.startsWith(tok)) return 90;
    if (aliases.some(a => a.startsWith(tok))) return 85;
    if (words.some(w => w.startsWith(tok))) return 80;
    if (name.includes(tok) || route.includes(tok)) return 60;
    if (aliases.some(a => a.includes(tok))) return 50;
    if (norm(t.category).includes(tok)) return 30;
    if (norm(t.desc).includes(tok)) return 20;
    return 0;
  }
  /**
   * Rank tools for a palette query. Every whitespace-separated token must match.
   * Order: strong matches (any token scoring ≥80 on average) before weak ones; within a tier
   * favorites first, then score, then registry order. Empty query: favorites, then registry order.
   */
  function rankTools(query, tools, favs) {
    const toks = norm(query).split(/\s+/).filter(Boolean);
    const fav = new Set(favs || []);
    const scored = [];
    tools.forEach((t, i) => {
      let score = 0;
      for (const tok of toks) { const sc = tokenScore(tok, t); if (!sc) return; score += sc; }
      const avg = toks.length ? score / toks.length : 0;
      scored.push({ tool: t, tier: toks.length && avg < 80 ? 1 : 0, fav: fav.has(t.route) ? 0 : 1, score, i });
    });
    scored.sort((a, b) => a.tier - b.tier || a.fav - b.fav || b.score - a.score || a.i - b.i);
    return scored.map(s => s.tool);
  }

  // ── keyboard shortcuts preference (single-key shortcuts can be switched off: WCAG 2.1.4) ──
  const SHORTCUTS_KEY = 'devtools:shortcuts';
  function shortcutsOn() { try { return localStorage.getItem(SHORTCUTS_KEY) !== 'off'; } catch { return true; } }
  const typingIn = (node) => !!node && (/^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) || node.isContentEditable);

  // ── command palette: native modal <dialog> + APG combobox/listbox ──
  let palette = null;
  function buildPalette() {
    const input = el('input', {
      type: 'text', class: 'pal-input', role: 'combobox', 'aria-expanded': 'true', 'aria-autocomplete': 'list',
      'aria-controls': 'pal-list', 'aria-label': 'Find a tool', placeholder: 'Find a tool…',
      autocomplete: 'off', spellcheck: 'false',
    });
    const list = el('ul', { class: 'pal-list', id: 'pal-list', role: 'listbox', 'aria-label': 'Tools' });
    const empty = el('p', { class: 'pal-empty', hidden: true }, 'No tool matches. Try a shorter word, e.g. "json" or "hash".');
    const closeBtn = el('button', { type: 'button', class: 'pal-close', 'aria-label': 'Close' }, '✕');
    const dlg = el('dialog', { class: 'palette', 'aria-label': 'Find a tool' },
      el('div', { class: 'pal-head' }, input, closeBtn), list, empty,
      el('div', { class: 'pal-hint', 'aria-hidden': 'true' },
        el('span', null, el('kbd', null, '↑'), el('kbd', null, '↓'), ' move'),
        el('span', null, el('kbd', null, '↵'), ' open'),
        el('span', null, el('kbd', null, 'esc'), ' close')));
    document.body.appendChild(dlg);

    let items = [], active = 0, opener = null;
    const tools = allTools();
    function setActive(i) {
      active = Math.max(0, Math.min(i, items.length - 1));
      $$('[role=option]', list).forEach((li, j) => {
        li.setAttribute('aria-selected', String(j === active));
        if (j === active) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
      });
      if (!items.length) input.removeAttribute('aria-activedescendant');
    }
    function render() {
      const favs = readFavs();
      items = rankTools(input.value, tools, favs);
      list.replaceChildren(...items.map((t, i) => el('li', {
        id: 'pal-opt-' + t.route, role: 'option', 'aria-selected': 'false', 'data-route': t.route,
        onclick: () => go(t), onmousemove: () => { if (active !== i) setActive(i); },
      }, el('span', { class: 'pal-name' }, (favs.includes(t.route) ? '★ ' : '') + t.name),
         el('span', { class: 'pal-cat' }, t.category))));
      empty.hidden = items.length > 0;
      input.setAttribute('aria-expanded', String(items.length > 0));
      setActive(0);
      announce(items.length === 1 ? '1 tool' : items.length + ' tools');
    }
    function go(t) { if (t) location.assign('/' + t.route); }
    function open() {
      if (dlg.open) return;
      opener = document.activeElement;
      input.value = '';
      render();
      dlg.showModal();
      input.focus();
    }
    function close() { if (dlg.open) dlg.close(); }
    closeBtn.addEventListener('click', close);
    dlg.addEventListener('close', () => { if (opener && document.contains(opener)) opener.focus(); opener = null; });
    let downOnBackdrop = false;
    dlg.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === dlg; });
    dlg.addEventListener('click', (e) => { if (e.target === dlg && downOnBackdrop) close(); downOnBackdrop = false; }); // backdrop click
    input.addEventListener('input', render);
    dlg.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return; // IME candidate selection (DEV-B-04)
      if (e.target !== input && e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      if (e.target !== input && /^(ArrowDown|ArrowUp|Home|End|Enter)$/.test(e.key)) input.focus();
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Home' && items.length) { e.preventDefault(); setActive(0); }
      else if (e.key === 'End' && items.length) { e.preventDefault(); setActive(items.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(items[active]); }
    });
    return { open, close, dialog: dlg };
  }
  function openPalette() { (palette || (palette = buildPalette())).open(); }

  // ── header + sidebar ──
  function currentRoute() {
    const seg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    return seg.replace(/\.html$/, '') === 'index' ? '' : seg;
  }

  const total = CATEGORIES.reduce((n, c) => n + c.tools.length, 0);
  /** Two-digit sheet number of a tool: its position in the registry (01–28). */
  function sheetNo(route) { return String(allTools().findIndex(t => t.route === route) + 1).padStart(2, '0'); }

  function buildHeader(active) {
    const header = $('#site-header');
    if (!header) return;
    const toggle = el('button', {
      class: 'menu-toggle', 'aria-label': 'Toggle navigation', 'aria-controls': 'sidebar', 'aria-expanded': 'false',
      onclick: () => setNav(!document.body.classList.contains('nav-open')),
    }, '☰');
    header.replaceChildren(
      el('a', { class: 'skip-link', href: '#main' }, active ? 'Skip to tool' : 'Skip to content'),
      toggle,
      el('a', { class: 'logo', href: '/', 'aria-label': 'Moya / DT-28 — all tools' },
        el('span', { class: 'logo-dot', 'aria-hidden': 'true' }), 'Moya', el('span', { class: 'logo-sep', 'aria-hidden': 'true' }, '/'), 'DT‑28'),
      el('span', { class: 'header-tool' }, active ? active.name : ''),
      el('button', { type: 'button', class: 'find-btn', 'aria-keyshortcuts': shortcutsOn() ? 'Control+K Meta+K /' : 'Control+K Meta+K', onclick: openPalette },
        el('span', { class: 'find-label' }, el('span', { class: 'find-long' }, 'Find a tool…'), el('span', { class: 'find-short' }, 'Find')), el('kbd', { 'aria-hidden': 'true' }, '/')),
      el('span', { class: 'spacer' }),
      el('span', { class: 'sheet-count', 'aria-hidden': 'true' }, active ? `Sheet ${sheetNo(active.route)} / ${total}` : `${total} sheets`),
      el('span', { class: 'badge-private', title: 'Everything runs in your browser — nothing is uploaded' }, el('span', { class: 'badge-long' }, 'Client-side only'), el('span', { class: 'badge-short' }, 'No upload')),
    );
  }

  /** Open/close the mobile navigation drawer, keeping ARIA state and focus in sync. */
  function setNav(open, focusSearch) {
    document.body.classList.toggle('nav-open', open);
    const toggle = $('.menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    // while the drawer covers the page, keep keyboard focus out of the covered content
    const page = $('main');
    if (page) page.inert = open && window.matchMedia('(max-width: 860px)').matches;
    if (open) { const first = $('#sidebar a, #sidebar button'); if (first && focusSearch !== false) setTimeout(() => first.focus(), 30); }
    else if (toggle && document.activeElement && $('#sidebar') && $('#sidebar').contains(document.activeElement)) toggle.focus();
  }

  /** Expose pressed state of .seg toggle buttons to assistive tech; keeps working when pages toggle `.on`. */
  function wireSegments() {
    const sync = (seg) => $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('on'))));
    $$('.seg').forEach(seg => {
      if (!seg.hasAttribute('role')) seg.setAttribute('role', 'group');
      // name the group from the visible option label just before it (e.g. "Operation")
      if (!seg.hasAttribute('aria-label') && !seg.hasAttribute('aria-labelledby')) {
        let prev = seg.previousElementSibling;
        if (!prev && seg.parentElement) prev = seg.parentElement.querySelector('.opt-label');
        if (prev && prev.classList.contains('opt-label')) {
          if (!prev.id) prev.id = 'seg-label-' + Math.random().toString(36).slice(2, 8);
          seg.setAttribute('aria-labelledby', prev.id);
        }
      }
      sync(seg);
      new MutationObserver(() => sync(seg)).observe(seg, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    });
  }

  /** Give unlabeled textareas an accessible name from their panel title. */
  function labelTextareas() {
    let n = 0;
    $$('textarea').forEach(ta => {
      if (ta.hasAttribute('aria-label') || ta.hasAttribute('aria-labelledby') || (ta.id && $('label[for="' + ta.id + '"]'))) return;
      const panel = ta.closest('.panel');
      const title = panel && $('.panel-title', panel);
      if (title) {
        if (!title.id) title.id = 'panel-title-' + (++n);
        ta.setAttribute('aria-labelledby', title.id);
      } else if (ta.placeholder) {
        ta.setAttribute('aria-label', ta.placeholder);
      }
    });
  }

  function buildSidebar(activeRoute) {
    const side = $('#sidebar');
    if (!side) return;
    const favs = readFavs();
    const tools = allTools();
    const list = el('nav', { class: 'side-nav', 'aria-label': 'Tools' });

    function link(t, hint, inFavs) {
      const isFav = favs.includes(t.route);
      const star = el('button', {
        class: 'fav-btn' + (isFav ? ' on' : ''), title: isFav ? 'Remove from favorites' : 'Add to favorites',
        'aria-label': (isFav ? 'Remove ' : 'Add ') + t.name + (isFav ? ' from favorites' : ' to favorites'),
        'aria-pressed': String(isFav), 'data-route': t.route,
        onclick: (e) => { e.preventDefault(); toggleFav(t.route); },
      }, isFav ? '★' : '☆');
      const here = t.route === activeRoute;
      return el('div', { class: 'side-item' + (here ? ' active' : '') },
        el('a', { href: '/' + t.route, class: 'side-link', title: t.desc, 'aria-current': here && !inFavs ? 'page' : null },
          el('span', { class: 'side-num', 'aria-hidden': 'true' }, sheetNo(t.route)),
          el('span', { class: 'side-name' }, t.name),
          hint ? el('kbd', { class: 'side-key', 'aria-hidden': 'true' }, hint) : null),
        star);
    }

    function render() {
      const on = shortcutsOn();
      list.replaceChildren();
      list.appendChild(el('a', { href: '/', class: 'side-home' + (activeRoute === '' ? ' active' : ''), 'aria-current': activeRoute === '' ? 'page' : null }, 'All tools'));
      const favTools = favs.map(r => tools.find(t => t.route === r)).filter(Boolean);
      if (favTools.length) {
        list.appendChild(el('div', { class: 'side-group side-favs' }, el('div', { class: 'side-group-title' }, '★ Favorites'),
          favTools.map((t, i) => link(t, on && i < 9 ? 'g' + (i + 1) : null, true))));
      }
      for (const c of CATEGORIES) {
        list.appendChild(el('div', { class: 'side-group' }, el('div', { class: 'side-group-title' }, c.name), c.tools.map(t => link(t))));
      }
    }

    function toggleFav(route) {
      favs.splice(0, favs.length, ...readFavs()); // another tab may have changed them
      const i = favs.indexOf(route);
      if (i >= 0) favs.splice(i, 1); else favs.push(route);
      writeFavs(favs);
      render();
      // keep keyboard focus on the star that was toggled (render() rebuilt the list)
      const again = $$('.fav-btn', list).filter(b => b.dataset.route === route);
      if (again.length) again[again.length - 1].focus();
      announce(i >= 0 ? 'Removed from favorites' : 'Added to favorites');
      document.dispatchEvent(new CustomEvent('devtools:favorites', { detail: favs.slice() }));
    }

    // single-key shortcuts ("/" and g+digit) can be switched off — WCAG 2.1.4
    const toggle = el('button', { type: 'button', class: 'shortcut-switch', role: 'switch', 'aria-checked': String(shortcutsOn()),
      onclick: () => {
        const next = !shortcutsOn();
        try { localStorage.setItem(SHORTCUTS_KEY, next ? 'on' : 'off'); } catch { /* preference just won't persist */ }
        toggle.setAttribute('aria-checked', String(next));
        syncShortcutsUi();
        render();
        announce(next ? 'Keyboard shortcuts on' : 'Keyboard shortcuts off');
      } }, el('span', { class: 'switch-track', 'aria-hidden': 'true' }), 'Single-key shortcuts');
    const help = el('p', { class: 'side-help' },
      el('span', { class: 'k-single' }, el('kbd', null, '/'), ' find · ', el('kbd', null, 'g'), el('kbd', null, '1'), ' favorite · '),
      el('kbd', null, '⌘K'), ' / ', el('kbd', null, 'Ctrl+K'), ' find');
    side.replaceChildren(list, el('div', { class: 'side-foot' }, toggle, help));
    render();
  }

  /** Drawing title block for a tool page: tool, sheet, revision, signature. Presentation only. */
  function buildTitleBlock(active) {
    const main = $('main');
    if (!main || !active || $('.titleblock', main)) return;
    const cell = (label, value, cls) => el('div', { class: 'tb-cell' + (cls ? ' ' + cls : '') }, el('dt', null, label), el('dd', null, value));
    const block = el('dl', { class: 'titleblock', 'aria-label': 'Drawing title block' },
      cell('Tool', active.name, 'tb-tool'),
      cell('Sheet', `${sheetNo(active.route)} / ${total}`),
      cell('Rev.', active.rev || '—'),
      cell('Drawn by', el('a', { href: 'https://mehmetoya.com', rel: 'author' }, 'M. Oya'), 'tb-sig'),
      cell('Scale', '1 : 1'),
      cell('Runs', 'Client-only'));
    const about = $('.about', main);
    if (about) main.insertBefore(block, about); else main.appendChild(block);
  }

  /** Colophon on every page: who made it, how it is set, what it does not do. */
  function buildColophon(active) {
    const main = $('main');
    if (!main || $('.colophon', main)) return;
    const latest = allTools().map(t => t.rev || '').sort().pop();
    main.appendChild(el('footer', { class: 'colophon' },
      el('span', null, 'Made by hand by ', el('a', { href: 'https://mehmetoya.com', rel: 'author' }, 'Mehmet Oya'),
        ' · ', el('a', { href: 'https://github.com/mehmetoya/devtools', rel: 'noopener' }, 'source on GitHub')),
      el('span', null, 'Part of ', el('a', { href: 'https://mehmetoya.com' }, 'mehmetoya.com')),
      el('span', null, 'Set in IBM Plex Sans Condensed, Plex Sans & Plex Mono'),
      el('span', null, 'No trackers · no server · CSP-locked'),
      el('span', null, 'Rev. ' + ((active && active.rev) || latest))));
  }

  /** Reflect the single-key shortcut preference: hint text and aria-keyshortcuts only promise what works. */
  function syncShortcutsUi() {
    const on = shortcutsOn();
    document.body.dataset.shortcuts = on ? 'on' : 'off';
    $$('[aria-keyshortcuts]').forEach(b => b.setAttribute('aria-keyshortcuts', on ? 'Control+K Meta+K /' : 'Control+K Meta+K'));
  }

  /** g then 1–9 within a second opens that favorite. */
  function wireFavoriteKeys() {
    let armed = 0;
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !shortcutsOn() || typingIn(document.activeElement)) { armed = 0; return; }
      if (armed && Date.now() - armed < 1000 && /^[1-9]$/.test(e.key)) {
        armed = 0;
        const route = readFavs()[Number(e.key) - 1];
        if (route && allTools().some(t => t.route === route)) { e.preventDefault(); location.assign('/' + route); }
        return;
      }
      armed = e.key === 'g' && !e.shiftKey ? Date.now() : 0;
    });
  }

  function init() {
    const route = currentRoute();
    const active = allTools().find(t => t.route === route);
    buildHeader(active);
    buildSidebar(route);
    wireFavoriteKeys();
    buildTitleBlock(active);
    buildColophon(active);
    syncShortcutsUi();
    const main = $('main');
    if (main && !main.id) main.id = 'main';
    if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    wireSegments();
    labelTextareas();
    const narrow = window.matchMedia('(max-width: 860px)');
    narrow.addEventListener('change', () => { if (!narrow.matches && document.body.classList.contains('nav-open')) setNav(false, false); });
    // close mobile nav on backdrop click or Escape
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('nav-open') && e.target.classList && e.target.classList.contains('nav-backdrop')) setNav(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
    });
    // palette: ⌘K / Ctrl+K always; "/" only when not typing and single-key shortcuts are on
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.altKey) return;
      const cmdK = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k';
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && shortcutsOn() && !typingIn(document.activeElement);
      if (cmdK || slash) {
        e.preventDefault();
        if (document.body.classList.contains('nav-open')) setNav(false);
        openPalette();
      }
    });
  }

  window.DevTools = { CATEGORIES, allTools, rankTools, openPalette, el, $, $$, debounce, copy, download, msg, invalid, announce, readFavs, writeFavs };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
