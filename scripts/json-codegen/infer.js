  /* ── JSON type inference (shared by the JSON → code generators) ── */
  // ISO-8601 date / date-time as System.Text.Json reads it; components are range-checked in isRealDate.
  const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,7})?)?(?:Z|[+-](\d{2}):(\d{2}))?)?$/;
  function isRealDate(s) {
    const m = ISO_DATE.exec(s);
    if (!m) return false;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1 || mo < 1 || mo > 12 || d < 1) return false;
    const dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
    if (d > dim) return false;
    if (m[4] !== undefined && (+m[4] > 23 || +m[5] > 59 || (m[6] !== undefined && +m[6] > 59))) return false;
    if (m[7] !== undefined && (+m[7] > 14 || +m[8] > 59)) return false;
    return true;
  }
  const INT32_MIN = -(2n ** 31n), INT32_MAX = 2n ** 31n - 1n;
  const INT64_MIN = -(2n ** 63n), INT64_MAX = 2n ** 63n - 1n, UINT64_MAX = 2n ** 64n - 1n;

  /** Numeric kind from the number's source text: '.', 'e' → double; integers by range: int, long, ulong (positive,
      beyond long), big (beyond 64 bits). neg records a negative sample so merging with ulong widens to big. */
  function numberType(raw) {
    if (/[.eE]/.test(raw)) return { k: 'double' };
    const v = BigInt(raw), neg = v < 0n;
    const k = v >= INT32_MIN && v <= INT32_MAX ? 'int' : v >= INT64_MIN && v <= INT64_MAX ? 'long' : v > 0n && v <= UINT64_MAX ? 'ulong' : 'big';
    return neg ? { k, neg } : { k };
  }

  /** Infer the type of a lossless-parser node (see parseLossless). */
  function inferType(n, opts) {
    switch (n.t) {
      case 'z': return { k: 'null' };
      case 'b': return { k: 'bool' };
      case 'n': return numberType(n.raw);
      case 's': return { k: opts && opts.dates && isRealDate(n.v) ? 'date' : 'string' };
      case 'a': {
        let elem = null;
        for (const x of n.e) elem = mergeType(elem, inferType(x, opts));
        return { k: 'array', elem };
      }
    }
    const fields = new Map();
    for (const [key, v] of n.e) {
      const t = inferType(v, opts), prev = fields.get(key); // a duplicate key merges both samples
      fields.set(key, { type: prev ? mergeType(prev.type, t) : t, optional: false });
    }
    return { k: 'object', fields };
  }

  function family(k) { return k in NUM_RANK ? 'num' : k === 'date' ? 'string' : k; }
  const NUM_RANK = { int: 0, long: 1, ulong: 2, big: 3, double: 4 };
  function mergeNum(a, b) {
    const neg = !!(a.neg || b.neg);
    let k = NUM_RANK[a.k] >= NUM_RANK[b.k] ? a.k : b.k;
    if (k === 'ulong' && neg) k = 'big'; // a negative sample cannot be stored in ulong
    return neg ? { k, neg } : { k };
  }

  function mergeFields(fa, fb) {
    const out = new Map();
    for (const [key, f] of fa) {
      const g = fb.get(key);
      out.set(key, g ? { type: mergeType(f.type, g.type), optional: f.optional || g.optional } : { type: f.type, optional: true });
    }
    for (const [key, g] of fb) if (!fa.has(key)) out.set(key, { type: g.type, optional: true });
    return out;
  }

  function addMember(members, t) {
    const i = members.findIndex(m => family(m.k) === family(t.k));
    if (i >= 0) members[i] = mergeType(members[i], t); else members.push(t);
  }

  /** Merge two inferred types (null = "no information yet"). */
  function mergeType(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.k === 'null' && b.k === 'null') return a;
    if (a.k === 'null') return Object.assign({}, b, { nullable: true });
    if (b.k === 'null') return Object.assign({}, a, { nullable: true });
    const nullable = !!(a.nullable || b.nullable);
    let r;
    if (a.k === 'mixed' || b.k === 'mixed' || family(a.k) !== family(b.k)) {
      const members = [];
      for (const t of [a, b]) for (const m of (t.k === 'mixed' ? t.members : [t])) addMember(members, Object.assign({}, m, { nullable: false }));
      r = members.length === 1 ? members[0] : { k: 'mixed', members };
    } else if (a.k === 'object') r = { k: 'object', fields: mergeFields(a.fields, b.fields) };
    else if (a.k === 'array') r = { k: 'array', elem: mergeType(a.elem, b.elem) };
    else if (family(a.k) === 'num') r = mergeNum(a, b);
    else if (a.k !== b.k) r = { k: 'string' }; // date + string
    else r = { k: a.k };
    if (nullable) r = Object.assign({}, r, { nullable: true });
    return r;
  }

  function splitWords(s) {
    return String(s)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[^A-Za-z0-9]+/).filter(Boolean)
      .map(w => (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) ? w[0] + w.slice(1).toLowerCase() : w);
  }
  function fixLeadingDigit(s) { return /^[0-9]/.test(s) ? '_' + s : s; }
  function toPascal(s) { const w = splitWords(s); return fixLeadingDigit(w.map(x => x[0].toUpperCase() + x.slice(1)).join('')); }
  function toCamel(s) {
    const w = splitWords(s);
    if (!w.length) return '';
    return fixLeadingDigit(w[0].toLowerCase() + w.slice(1).map(x => x[0].toUpperCase() + x.slice(1)).join(''));
  }
  function sanitizeIdent(s) { const r = String(s).replace(/[^A-Za-z0-9_]/g, '_'); return fixLeadingDigit(r) || '_'; }
  function singular(name) {
    if (/ies$/.test(name) && name.length > 3) return name.slice(0, -3) + 'y';
    if (/(ss|us|is)$/.test(name)) return name + 'Item';
    if (/s$/.test(name) && name.length > 1) return name.slice(0, -1);
    return name + 'Item';
  }
  function uniqueName(base, used) {
    let n = base || 'Item', i = 2;
    while (used.has(n)) n = base + (i++);
    used.add(n);
    return n;
  }

  /** Assign class names to every object type reachable from root; returns them in declaration order. */
  function collectClasses(root, rootName, reserved, includeMixed) {
    const used = new Set(reserved || []), classes = [];
    function visit(t, hint) {
      if (!t) return;
      if (t.k === 'object') {
        t.name = uniqueName(hint, used);
        classes.push(t);
        for (const [key, f] of t.fields) visit(f.type, toPascal(key) || 'Field');
      } else if (t.k === 'array') visit(t.elem, singular(hint));
      else if (t.k === 'mixed' && includeMixed) t.members.forEach(m => visit(m, hint));
    }
    if (root && root.k === 'array') visit(root.elem, rootName); else visit(root, rootName);
    return classes;
  }

  /** Parse JSON text losslessly (number text kept) and infer its type. Throws SyntaxError (.line/.col) on invalid JSON. */
  function analyze(text, opts) {
    const { root } = parseLossless(text);
    return { root, type: inferType(root, opts) };
  }
