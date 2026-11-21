  /* ── Lossless JSON parser: keeps number source text and duplicate keys ──
     Nodes: { t: 'o', e: [[key, node], ...] }  { t: 'a', e: [node, ...] }  { t: 's', v }  { t: 'n', raw }
            { t: 'b', v }  { t: 'z' } (null). Errors are SyntaxErrors with .pos (offset), .line and .col. */
  const LJ_STR = /"[^"\\\u0000-\u001f]*(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})[^"\\\u0000-\u001f]*)*"/y;
  const LJ_NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  function lineColAt(text, pos) {
    let line = 1, last = -1;
    for (let k = text.indexOf('\n'); k !== -1 && k < pos; k = text.indexOf('\n', k + 1)) { line++; last = k; }
    return { line, col: pos - last };
  }
  function parseLossless(text) {
    let i = 0;
    const dups = [];
    function fail(message, pos) {
      if (pos !== undefined) i = pos;
      const e = new SyntaxError(message);
      const lc = lineColAt(text, i);
      e.pos = i; e.line = lc.line; e.col = lc.col;
      throw e;
    }
    function ch() { return i < text.length ? JSON.stringify(text[i]) : 'end of input'; }
    function ws() {
      for (;;) { const c = text.charCodeAt(i); if (c === 32 || c === 10 || c === 13 || c === 9) i++; else return; }
    }
    function strFail() {
      for (let k = i + 1; k < text.length; k++) {
        const c = text.charCodeAt(k);
        if (c === 34) break;
        if (c < 32) fail('Unescaped control character in a string — write it as an escape such as \\n or \\t.', k);
        if (c === 92) {
          const n = text[k + 1];
          if (n === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(text.substr(k + 2, 4))) fail('Invalid \\u escape — it needs exactly 4 hex digits.', k); k += 5; }
          else if (n !== undefined && '"\\/bfnrt'.includes(n)) k++;
          else fail('Invalid escape sequence "\\' + (n || '') + '" — only \\" \\\\ \\/ \\b \\f \\n \\r \\t and \\uXXXX are allowed.', k);
        }
      }
      fail('Unterminated string — add the closing double quote (").', i);
    }
    function str() {
      LJ_STR.lastIndex = i;
      const m = LJ_STR.exec(text);
      if (!m) strFail();
      i = LJ_STR.lastIndex;
      const s = m[0];
      return s.indexOf('\\') < 0 ? s.slice(1, -1) : JSON.parse(s);
    }
    function badValue() {
      const c = text[i];
      if (i >= text.length) fail('Unexpected end of input — a value, closing bracket or brace is missing.');
      if (c === "'") fail('Strings must use double quotes (") — single quotes are not valid JSON.');
      if (c === '}' || c === ']') fail('Unexpected ' + ch() + ' — remove the trailing comma before it, or add a value.');
      const word = /^[A-Za-z_$][\w$]*/.exec(text.slice(i, i + 32));
      if (word) fail('Unexpected word "' + word[0] + '" — JSON only allows true, false, null, numbers and "strings".');
      fail('Unexpected ' + ch() + ' — expected a value.');
    }
    function value() {
      ws();
      const c = text.charCodeAt(i);
      if (c === 34) return { t: 's', v: str() };
      if (c === 123) {
        i++; ws();
        const e = [];
        if (text.charCodeAt(i) === 125) { i++; return { t: 'o', e }; }
        const seen = new Set();
        for (;;) {
          ws();
          if (text.charCodeAt(i) !== 34) {
            if (text[i] === "'") fail('Property names must use double quotes (") — single quotes are not valid JSON.');
            if (text[i] === '}') fail('Trailing comma before "}" — remove the last comma.');
            if (i >= text.length) fail('Unexpected end of input — a closing "}" is missing.');
            fail('Expected a double-quoted property name, found ' + ch() + '.');
          }
          const kpos = i, k = str();
          ws();
          if (text.charCodeAt(i) !== 58) fail('Expected ":" after property name ' + JSON.stringify(k) + ', found ' + ch() + '.');
          i++;
          const v = value();
          if (seen.has(k)) dups.push({ key: k, pos: kpos }); else seen.add(k);
          e.push([k, v]);
          ws();
          const d = text.charCodeAt(i);
          if (d === 44) { i++; continue; }
          if (d === 125) { i++; return { t: 'o', e }; }
          if (i >= text.length) fail('Unexpected end of input — a closing "}" is missing.');
          fail('Expected "," or "}" after a property value, found ' + ch() + '.');
        }
      }
      if (c === 91) {
        i++; ws();
        const e = [];
        if (text.charCodeAt(i) === 93) { i++; return { t: 'a', e }; }
        for (;;) {
          e.push(value());
          ws();
          const d = text.charCodeAt(i);
          if (d === 44) { i++; continue; }
          if (d === 93) { i++; return { t: 'a', e }; }
          if (i >= text.length) fail('Unexpected end of input — a closing "]" is missing.');
          fail('Expected "," or "]" after an array element, found ' + ch() + '.');
        }
      }
      if (c === 45 || (c >= 48 && c <= 57)) {
        LJ_NUM.lastIndex = i;
        const m = LJ_NUM.exec(text);
        if (!m) fail('Invalid number — a digit must follow "-".');
        i = LJ_NUM.lastIndex;
        const n = text.charCodeAt(i);
        if (n >= 48 && n <= 57) fail('Invalid number — leading zeros are not allowed.', i - 1);
        if (n === 46 || n === 101 || n === 69) fail('Invalid number — a digit must follow "' + text[i] + '".');
        return { t: 'n', raw: m[0] };
      }
      if (text.startsWith('true', i)) { i += 4; return { t: 'b', v: true }; }
      if (text.startsWith('false', i)) { i += 5; return { t: 'b', v: false }; }
      if (text.startsWith('null', i)) { i += 4; return { t: 'z' }; }
      badValue();
    }
    let root;
    try {
      root = value();
    } catch (e) {
      if (e instanceof RangeError) { const r = new SyntaxError('The JSON is nested too deeply to process.'); r.pos = -1; throw r; }
      throw e;
    }
    ws();
    if (i < text.length) fail('Unexpected ' + ch() + ' after the end of the JSON value — remove it, or wrap several values in an array.');
    return { root, dups };
  }
  /** Describe duplicate keys for a message (null when there are none). */
  function describeDups(text, dups, label) {
    if (!dups.length) return null;
    const first = dups[0], lc = lineColAt(text, first.pos);
    return (label ? label + ': d' : 'D') + 'uplicate key ' + JSON.stringify(first.key) + ' at line ' + lc.line +
      ' — later value wins in most parsers' + (dups.length > 1 ? ' (' + (dups.length - 1) + ' more duplicate' + (dups.length > 2 ? 's' : '') + ')' : '') + '.';
  }
  /** Serialize a node like JSON.stringify(value, null, indent), keeping number text and duplicate keys. */
  function stringifyNode(node, indent, sortKeys) {
    const ind = typeof indent === 'number' ? ' '.repeat(Math.max(0, Math.min(10, indent))) : (indent || '');
    const colon = ind ? ': ' : ':', out = [];
    const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    function w(n, pad) {
      switch (n.t) {
        case 's': out.push(JSON.stringify(n.v)); return;
        case 'n': out.push(n.raw); return;
        case 'b': out.push(n.v ? 'true' : 'false'); return;
        case 'z': out.push('null'); return;
        case 'a': case 'o': {
          const obj = n.t === 'o', list = obj && sortKeys ? n.e.slice().sort(byKey) : n.e;
          const open = obj ? '{' : '[', close = obj ? '}' : ']';
          if (!list.length) { out.push(open + close); return; }
          const p2 = pad + ind, sep = ind ? ',\n' + p2 : ',';
          out.push(ind ? open + '\n' + p2 : open);
          for (let k = 0; k < list.length; k++) {
            if (k) out.push(sep);
            if (obj) { out.push(JSON.stringify(list[k][0]) + colon); w(list[k][1], p2); } else w(list[k], p2);
          }
          out.push(ind ? '\n' + pad + close : close);
        }
      }
    }
    w(node, '');
    return out.join('');
  }
