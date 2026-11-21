/*
 * Shared regex engine for the regex tools (Regex Search, Regex Replace, String Extract, Line Operations).
 *
 * This one file has two roles:
 *  - Loaded with `new Worker('/assets/regex-worker.js')` it is a Web Worker that runs regex jobs
 *    off the main thread and posts back plain data ({ id, ok, result } or { id, ok: false, error }).
 *  - Loaded with <script src="/assets/regex-worker.js"> it defines window.RegexWorker:
 *      RegexWorker.createRunner({ timeoutMs }) → { run(op, args) → Promise, terminate() }
 *    The runner kills and recreates the worker when a job exceeds the time budget (catastrophic
 *    backtracking cannot be interrupted any other way), and when a newer job supersedes a running one.
 *    If a worker cannot be created, jobs run synchronously on the main thread (no time limit).
 *
 * No eval / new Function; the only dynamic code is `new RegExp(pattern, flags)`.
 */
(function (root) {
  'use strict';

  const TIMEOUT_MSG = 'Regex took too long (possible catastrophic backtracking) — simplify the pattern.';

  /** Flags without g/y, deduplicated, with g added. */
  function globalFlags(flags) {
    return Array.from(new Set(String(flags || '').replace(/[gy]/g, '') + 'g')).join('');
  }

  /** Index just past position i; in unicode mode a surrogate pair is stepped over as one code point. */
  function advanceIndex(text, i, unicode) {
    if (unicode && i < text.length - 1) {
      const c = text.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF) {
        const d = text.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) return i + 2;
      }
    }
    return i + 1;
  }

  /**
   * All matches. Returns { matches: [{ index, length, value, groups, named }], total, truncated, timedOut }.
   * limit: stop counting after this many matches. budgetMs: stop (with partial results) after this much time.
   */
  function findMatches(text, pattern, flags, limit, budgetMs) {
    limit = limit || 100000; budgetMs = budgetMs || 1000;
    const re = new RegExp(pattern, globalFlags(flags));
    const matches = [];
    const t0 = Date.now();
    let m, truncated = false, timedOut = false;
    while ((m = re.exec(text)) !== null) {
      matches.push({ index: m.index, length: m[0].length, value: m[0], groups: m.slice(1), named: m.groups ? Object.assign({}, m.groups) : null });
      if (m[0] === '') re.lastIndex = advanceIndex(text, re.lastIndex, re.unicode);
      if (matches.length >= limit) { truncated = re.lastIndex <= text.length && re.exec(text) !== null; break; }
      if ((matches.length & 1023) === 0 && Date.now() - t0 > budgetMs) { timedOut = true; break; }
    }
    return { matches, total: matches.length, truncated, timedOut };
  }

  /** Expand $-references in a replacement string, following JavaScript's String.prototype.replace rules. */
  function expandReplacement(rep, match, captures, index, input, named) {
    let out = '';
    const m = captures.length;
    for (let i = 0; i < rep.length; i++) {
      const ch = rep[i];
      if (ch !== '$' || i === rep.length - 1) { out += ch; continue; }
      const nx = rep[i + 1];
      if (nx === '$') { out += '$'; i++; }
      else if (nx === '&') { out += match; i++; }
      else if (nx === '`') { out += input.slice(0, index); i++; }
      else if (nx === "'") { out += input.slice(index + match.length); i++; }
      else if (nx >= '0' && nx <= '9') {
        const two = rep[i + 2] >= '0' && rep[i + 2] <= '9' ? parseInt(nx + rep[i + 2], 10) : -1;
        const one = parseInt(nx, 10);
        if (two >= 1 && two <= m) { out += captures[two - 1] == null ? '' : captures[two - 1]; i += 2; }
        else if (one >= 1 && one <= m) { out += captures[one - 1] == null ? '' : captures[one - 1]; i += 1; }
        else out += '$';
      } else if (nx === '<' && named) {
        const end = rep.indexOf('>', i + 2);
        if (end < 0) { out += '$'; continue; }
        const v = named[rep.slice(i + 2, end)];
        out += v == null ? '' : v;
        i = end;
      } else out += '$';
    }
    return out;
  }

  /** Returns { output, count }. max = 0 replaces all matches. (String.replace advances empty matches by code point under u.) */
  function regexReplace(text, pattern, flags, replacement, max) {
    const re = new RegExp(pattern, globalFlags(flags));
    let count = 0;
    const output = text.replace(re, function () {
      const args = Array.prototype.slice.call(arguments);
      const named = typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null ? args.pop() : null;
      const input = args.pop(), index = args.pop(), match = args[0], captures = args.slice(1);
      if (max > 0 && count >= max) return match;
      count++;
      return expandReplacement(replacement, match, captures, index, input, named);
    });
    return { output, count };
  }

  /** Every match's capture group `group` (0 = whole match). Returns { items, text }. */
  function extractRegex(text, pattern, group, flags, maxResults) {
    maxResults = maxResults || 100000;
    const re = new RegExp(pattern, globalFlags(flags));
    const g = Math.max(0, Math.trunc(Number(group) || 0));
    const items = [];
    let m, first = true;
    while ((m = re.exec(text)) !== null) {
      if (first) {
        if (g > m.length - 1) {
          const err = new Error('Group ' + g + ' does not exist — the pattern has ' + (m.length - 1) + ' capture group' + (m.length - 1 === 1 ? '' : 's') + '. Use 0 for the whole match.');
          err.name = 'GroupError';
          throw err;
        }
        first = false;
      }
      if (m[g] !== undefined) items.push(m[g]);
      if (m[0] === '') re.lastIndex = advanceIndex(text, re.lastIndex, re.unicode);
      if (items.length >= maxResults) break;
    }
    return { items, text: items.join('\n') };
  }

  /** Lines that match the pattern (flags must not contain g/y). Returns { lines }. */
  function filterLines(lines, pattern, flags) {
    const re = new RegExp(pattern, String(flags || '').replace(/[gy]/g, ''));
    return { lines: lines.filter(l => re.test(l)) };
  }

  const OPS = {
    search: a => findMatches(a.text, a.pattern, a.flags, a.limit, a.budgetMs),
    replace: a => regexReplace(a.text, a.pattern, a.flags, a.replacement, a.max),
    extract: a => extractRegex(a.text, a.pattern, a.group, a.flags, a.maxResults),
    filter: a => filterLines(a.lines, a.pattern, a.flags),
  };
  function runOp(op, args) {
    if (!Object.prototype.hasOwnProperty.call(OPS, op)) throw new Error('Unknown operation: ' + op);
    return OPS[op](args);
  }

  // ---- worker role ----
  const isWorker = typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope;
  if (isWorker) {
    root.onmessage = function (e) {
      const d = e.data || {};
      let reply;
      try { reply = { id: d.id, ok: true, result: runOp(d.op, d.args || {}) }; }
      catch (err) { reply = { id: d.id, ok: false, error: { name: (err && err.name) || 'Error', message: String((err && err.message) || err) } }; }
      root.postMessage(reply);
    };
    return;
  }

  // ---- page role ----
  function toError(o) {
    const e = o.name === 'SyntaxError' ? new SyntaxError(o.message) : new Error(o.message);
    if (o.name && o.name !== 'SyntaxError') e.name = o.name;
    return e;
  }

  function createRunner(opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs || 1500;
    const url = opts.url || '/assets/regex-worker.js';
    let worker = null, broken = typeof Worker === 'undefined', pending = null, nextId = 1;

    function kill() { if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } } worker = null; }
    function settle(p, fn) { pending = null; clearTimeout(p.timer); fn(); }
    function runLocal(op, args, resolve, reject) {
      let res;
      try { res = runOp(op, args); } catch (e) { reject(e); return; }
      resolve(res);
    }
    function spawn() {
      try {
        worker = new Worker(url);
      } catch (e) { broken = true; worker = null; return; }
      worker.onmessage = function (e) {
        const d = e.data;
        if (!pending || !d || d.id !== pending.id) return;
        const p = pending;
        settle(p, () => d.ok ? p.resolve(d.result) : p.reject(toError(d.error)));
      };
      worker.onerror = function (e) {
        // Script failed to load / start (blocked, 404…): fall back to the main thread from now on.
        if (e && e.preventDefault) e.preventDefault();
        broken = true; kill();
        if (pending) { const p = pending; settle(p, () => runLocal(p.op, p.args, p.resolve, p.reject)); }
      };
    }

    function run(op, args) {
      return new Promise(function (resolve, reject) {
        if (pending) {
          // A newer job supersedes the running one; the old caller ignores it via its own sequence id.
          const p = pending;
          settle(p, () => { const e = new Error('Superseded by a newer request.'); e.name = 'Superseded'; p.reject(e); });
          kill();
        }
        if (!worker && !broken) spawn();
        if (broken) { runLocal(op, args, resolve, reject); return; }
        const id = nextId++;
        const p = { id, op, args, resolve, reject, timer: 0 };
        p.timer = setTimeout(function () {
          if (pending !== p) return;
          kill();
          settle(p, () => { const e = new Error(TIMEOUT_MSG); e.name = 'RegexTimeout'; p.reject(e); });
        }, timeoutMs);
        pending = p;
        try { worker.postMessage({ id, op, args }); }
        catch (e) { settle(p, () => runLocal(op, args, resolve, reject)); }
      });
    }

    return { run, terminate: kill, get usingWorker() { return !broken; } };
  }

  root.RegexWorker = { createRunner, TIMEOUT_MSG, ops: { globalFlags, advanceIndex, findMatches, expandReplacement, regexReplace, extractRegex, filterLines, runOp } };
})(typeof self !== 'undefined' ? self : this);
