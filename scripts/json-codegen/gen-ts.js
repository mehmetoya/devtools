  /* ── TypeScript generator ── */
  const TS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  const TS_RESERVED_TYPES = ['Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Record', 'Promise', 'Map', 'Set'];

  /** opts: { rootName, useType, optional, exportKw, naming: 'camel' | 'keep' } */
  function generateTypeScript(text, opts) {
    opts = Object.assign({ rootName: 'Root', useType: false, optional: false, exportKw: true, naming: 'keep' }, opts);
    const rootName = toPascal(opts.rootName) || 'Root';
    const { type } = analyze(text, {});
    const ex = opts.exportKw ? 'export ' : '';
    const isRootArray = type.k === 'array';
    const itemName = isRootArray ? rootName + 'Item' : rootName;
    const classes = collectClasses(type, itemName, TS_RESERVED_TYPES, true);

    function base(t) {
      if (!t) return 'unknown';
      switch (t.k) {
        case 'int': case 'long': case 'double': case 'ulong': case 'big': case 'decimal': return 'number'; // JSON.parse yields number (precision beyond 2^53 is lost; use a bigint-aware parser if you need it)
        case 'bool': return 'boolean';
        case 'string': case 'date': return 'string';
        case 'null': return 'null';
        case 'object': return t.name;
        case 'array': {
          const e = typeStr(t.elem);
          return (/[|&]/.test(e) ? '(' + e + ')' : e) + '[]';
        }
        case 'mixed': return t.members.map(base).join(' | ');
        default: return 'unknown';
      }
    }
    function typeStr(t) {
      const s = base(t);
      return t && t.nullable && t.k !== 'null' ? s + ' | null' : s;
    }
    function propKey(key, used) {
      const base = opts.naming === 'camel' ? (toCamel(key) || key) : key;
      let n = base, i = 2;
      while (used.has(n)) n = base + (i++); // the empty key "" stays "" (uniqueName would turn it into Item)
      used.add(n);
      return TS_IDENT.test(n) ? n : JSON.stringify(n);
    }

    const blocks = [];
    if (isRootArray) blocks.push(ex + 'type ' + rootName + ' = ' + typeStr(type) + ';');
    else if (type.k !== 'object') blocks.push(ex + 'type ' + rootName + ' = ' + typeStr(type) + ';');
    for (const c of classes) {
      const used = new Set(), lines = [];
      for (const [key, f] of c.fields) {
        lines.push('  ' + propKey(key, used) + (f.optional || opts.optional ? '?' : '') + ': ' + typeStr(f.type) + ';');
      }
      const inner = lines.length ? '{\n' + lines.join('\n') + '\n}' : '{}';
      blocks.push(opts.useType ? ex + 'type ' + c.name + ' = ' + inner + ';' : ex + 'interface ' + c.name + ' ' + inner);
    }
    return { code: blocks.join('\n\n') + '\n', classes: classes.length };
  }
