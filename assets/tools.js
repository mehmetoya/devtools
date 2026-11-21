/* ── DevTools shared shell ──
 * Tool registry, header, sidebar navigation (search + favorites) and small DOM helpers.
 * Security rule: user-supplied data is only ever written with textContent / value — never innerHTML.
 */
(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'text', name: 'Text Operations', tools: [
      { route: 'case-converter',  name: 'Case Converter',     desc: 'camelCase, snake_case, PascalCase, kebab-case and more.' },
      { route: 'reverse',         name: 'String Reverse',     desc: 'Reverse strings, lines, words or each word.' },
      { route: 'trim-pad',        name: 'Trim / Pad',         desc: 'Trim whitespace or pad text to a width.' },
      { route: 'line-counter',    name: 'Line Counter',       desc: 'Lines, words, characters, bytes and more.' },
      { route: 'line-operations', name: 'Line Operations',    desc: 'Sort, dedupe, filter, number, join lines.' },
      { route: 'compare',         name: 'String Compare',     desc: 'Compare two strings line by line.' },
    ]},
    { id: 'encode', name: 'Encode / Decode', tools: [
      { route: 'base64',          name: 'Base64',             desc: 'Encode and decode Base64 (UTF-8, ASCII, UTF-16, UTF-32).' },
      { route: 'url-encode',      name: 'URL Encode',         desc: 'Percent-encode or decode URL strings.' },
      { route: 'hash-generator',  name: 'Hash Generator',     desc: 'MD5, SHA-1, SHA-256, SHA-384, SHA-512 + verify.' },
      { route: 'jwt-tool',        name: 'JWT Tool',           desc: 'Generate, decode and validate JSON Web Tokens.' },
    ]},
    { id: 'json', name: 'JSON Tools', tools: [
      { route: 'json-formatter',     name: 'JSON Formatter',  desc: 'Validate, beautify, minify, sort keys.' },
      { route: 'json-compare',       name: 'JSON Compare',    desc: 'Structural diff of two JSON documents.' },
      { route: 'json-to-csharp',     name: 'JSON to C#',      desc: 'Generate C# classes or records from JSON.' },
      { route: 'json-to-java',       name: 'JSON to Java',    desc: 'Generate Java POJOs / records from JSON.' },
      { route: 'json-to-typescript', name: 'JSON to TypeScript', desc: 'Generate TypeScript interfaces / types.' },
    ]},
    { id: 'regex', name: 'Regex Tools', tools: [
      { route: 'regex-search',    name: 'Regex Search',       desc: 'Find matches and capture groups.' },
      { route: 'regex-replace',   name: 'Regex Replace',      desc: 'Find and replace with group references.' },
      { route: 'extract',         name: 'String Extract',     desc: 'Extract by position, delimiters, regex or line range.' },
    ]},
    { id: 'dev', name: 'Developer Tools', tools: [
      { route: 'datetime-formatter', name: 'DateTime Formatter', desc: '.NET-style date/time format strings.' },
      { route: 'string-formatter',   name: 'String Formatter',   desc: 'Numeric formats, padding, composite formatting.' },
      { route: 'guid-generator',     name: 'GUID Generator',     desc: 'Generate and parse GUIDs / UUIDs.' },
      { route: 'password-generator', name: 'Password Generator', desc: 'Secure passwords with custom rules.' },
      { route: 'number-converter',   name: 'Number Converter',   desc: 'Binary, decimal, hexadecimal, octal.' },
      { route: 'barcode-generator',  name: 'Barcode Generator',  desc: 'QR codes, EAN-13 and EAN-8 barcodes.' },
      { route: 'http-client',        name: 'HTTP Client',        desc: 'Build and send HTTP requests.' },
    ]},
    { id: 'viewers', name: 'Viewers', tools: [
      { route: 'markdown-viewer',  name: 'Markdown Viewer',     desc: 'Live Markdown preview and export.' },
      { route: 'html-viewer',      name: 'HTML Viewer',         desc: 'Sandboxed live HTML preview.' },
      { route: 'diagram-viewer',   name: 'Diagram Viewer',      desc: 'Mermaid diagrams to SVG / PNG.' },
    ]},
  ];

  const FAV_KEY = 'devtools:favorites';

  // ── storage (never required for the page to work) ──
  function readFavs() {
    try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(v) ? v : []; }
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
      // point the field at the visible error message so returning to it explains why
      const err = $$('.msg.msg-error').find(m => !m.hidden && m.textContent);
      if (err) {
        if (!err.id) err.id = 'msg-' + Math.random().toString(36).slice(2, 8);
        node.setAttribute('aria-describedby', err.id);
      }
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
    node.textContent = text || '';
    node.hidden = !kind || !text;
  }

  function allTools() { return CATEGORIES.flatMap(c => c.tools.map(t => Object.assign({ category: c.name }, t))); }

  // ── header + sidebar ──
  function currentRoute() {
    const seg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    return seg.replace(/\.html$/, '') === 'index' ? '' : seg;
  }

  function buildHeader(active) {
    const header = $('#site-header');
    if (!header) return;
    const toggle = el('button', {
      class: 'menu-toggle', 'aria-label': 'Toggle navigation', 'aria-controls': 'sidebar', 'aria-expanded': 'false',
      onclick: () => setNav(!document.body.classList.contains('nav-open')),
    }, '☰');
    header.replaceChildren(
      el('a', { class: 'skip-link', href: '#main' }, 'Skip to tool'),
      toggle,
      el('a', { class: 'logo', href: '/' }, el('span', { class: 'logo-dot' }), 'DevTools'),
      el('span', { class: 'header-tool' }, active ? active.name : ''),
      el('span', { class: 'spacer' }),
      el('span', { class: 'badge-private', title: 'Everything runs in your browser — nothing is uploaded' }, el('span', { class: 'badge-long' }, 'Client-side only'), el('span', { class: 'badge-short' }, 'Local')),
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
    if (open) { const s = $('.side-search'); if (s && focusSearch !== false) setTimeout(() => s.focus(), 30); }
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

    const search = el('input', { type: 'search', class: 'side-search', placeholder: 'Search tools…', 'aria-label': 'Search tools' });
    const list = el('nav', { class: 'side-nav', 'aria-label': 'Tools' });

    function link(t) {
      const isFav = favs.includes(t.route);
      const star = el('button', {
        class: 'fav-btn' + (isFav ? ' on' : ''), title: isFav ? 'Remove from favorites' : 'Add to favorites',
        'aria-label': (isFav ? 'Remove ' : 'Add ') + t.name + (isFav ? ' from favorites' : ' to favorites'),
        'aria-pressed': String(isFav), 'data-route': t.route,
        onclick: (e) => { e.preventDefault(); toggleFav(t.route); },
      }, isFav ? '★' : '☆');
      return el('div', { class: 'side-item' + (t.route === activeRoute ? ' active' : '') },
        el('a', { href: '/' + t.route, class: 'side-link', title: t.desc }, t.name), star);
    }

    function render() {
      const q = search.value.trim().toLowerCase();
      list.replaceChildren();
      if (q) {
        const hits = tools.filter(t => (t.name + ' ' + t.desc + ' ' + t.route).toLowerCase().includes(q));
        list.appendChild(el('div', { class: 'side-group' }, el('div', { class: 'side-group-title' }, 'Results'),
          hits.length ? hits.map(link) : el('div', { class: 'side-empty' }, 'No tools found')));
        return;
      }
      list.appendChild(el('a', { href: '/', class: 'side-home' + (activeRoute === '' ? ' active' : '') }, 'Home'));
      const favTools = favs.map(r => tools.find(t => t.route === r)).filter(Boolean);
      if (favTools.length) {
        list.appendChild(el('div', { class: 'side-group' }, el('div', { class: 'side-group-title' }, '★ Favorites'), favTools.map(link)));
      }
      for (const c of CATEGORIES) {
        list.appendChild(el('div', { class: 'side-group' }, el('div', { class: 'side-group-title' }, c.name), c.tools.map(link)));
      }
    }

    function toggleFav(route) {
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

    search.addEventListener('input', render);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const a = $('.side-link', list); if (a) location.href = a.getAttribute('href'); }
      if (e.key === 'Escape') { search.value = ''; render(); }
    });
    side.replaceChildren(el('div', { class: 'side-search-wrap' }, search), list);
    render();

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
        e.preventDefault();
        if (window.matchMedia('(max-width: 860px)').matches) setNav(true); else search.focus();
      }
    });
  }

  function init() {
    const route = currentRoute();
    const active = allTools().find(t => t.route === route);
    buildHeader(active);
    buildSidebar(route);
    const main = $('main');
    if (main && !main.id) main.id = 'main';
    if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    wireSegments();
    labelTextareas();
    // close mobile nav on backdrop click or Escape
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('nav-open') && e.target.classList && e.target.classList.contains('nav-backdrop')) setNav(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setNav(false);
    });
  }

  window.DevTools = { CATEGORIES, allTools, el, $, $$, debounce, copy, download, msg, invalid, announce, readFavs, writeFavs };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
