  /* ── C# generator ── */
  const CS_KEYWORDS = new Set(('abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while').split(' '));
  const CS_RESERVED_TYPES = ['List', 'Object', 'String', 'DateTime', 'JsonPropertyName', 'Int32', 'Int64', 'UInt64', 'Decimal', 'Double', 'Boolean'];
  const CS_VALUE_TYPES = new Set(['int', 'long', 'ulong', 'decimal', 'double', 'bool', 'DateTime']);

  /** opts: { className, records, nullable, attributes, pascal, dates } */
  function generateCSharp(text, opts) {
    opts = Object.assign({ className: 'RootObject', records: false, nullable: false, attributes: true, pascal: true, dates: true }, opts);
    const rootName = toPascal(opts.className) || 'RootObject';
    const { type } = analyze(text, { dates: opts.dates });
    const isRootArray = type.k === 'array';
    if (!(type.k === 'object' || (isRootArray && type.elem && type.elem.k === 'object'))) {
      throw new Error('The top-level JSON value must be an object or an array of objects.');
    }
    const classes = collectClasses(type, rootName, CS_RESERVED_TYPES, false);
    const uses = { list: false, date: false };

    function typeStr(t, optional) {
      let s;
      if (!t) s = 'object';
      else switch (t.k) {
        case 'int': s = 'int'; break;
        case 'long': s = 'long'; break;
        case 'ulong': s = 'ulong'; break;
        case 'big': s = 'decimal'; break;
        case 'double': s = 'double'; break;
        case 'bool': s = 'bool'; break;
        case 'string': s = 'string'; break;
        case 'date': s = 'DateTime'; uses.date = true; break;
        case 'object': s = t.name; break;
        case 'array': s = 'List<' + typeStr(t.elem, false) + '>'; uses.list = true; break;
        default: s = 'object'; // null-only, mixed
      }
      // a value type that was null in any sample must be Nullable<T>, or deserializing that null throws
      if (t && t.nullable && CS_VALUE_TYPES.has(s)) s += '?';
      else if (opts.nullable && (!t || optional || t.nullable || t.k === 'null' || t.k === 'mixed')) s += '?';
      return s;
    }

    function propName(key, cls, used) {
      let n = opts.pascal ? toPascal(key) : sanitizeIdent(key);
      if (!n) n = 'Field';
      if (n === cls) n += 'Value';
      n = uniqueName(n, used);
      return CS_KEYWORDS.has(n) ? '@' + n : n;
    }

    const blocks = classes.map(c => {
      const used = new Set(), props = [];
      for (const [key, f] of c.fields) props.push({ key, name: propName(key, c.name, used), type: typeStr(f.type, f.optional) });
      const attr = p => '[' + (opts.records ? 'property: ' : '') + 'JsonPropertyName(' + JSON.stringify(p.key) + ')]';
      if (opts.records) {
        if (!props.length) return 'public record ' + c.name + '();';
        return 'public record ' + c.name + '(\n' +
          props.map(p => '    ' + (opts.attributes ? attr(p) + ' ' : '') + p.type + ' ' + p.name).join(',\n') + '\n);';
      }
      const body = props.map(p => (opts.attributes ? '    ' + attr(p) + '\n' : '') + '    public ' + p.type + ' ' + p.name + ' { get; set; }');
      return 'public class ' + c.name + '\n{\n' + body.join(opts.attributes ? '\n\n' : '\n') + (body.length ? '\n' : '') + '}';
    });

    const head = [];
    if (opts.nullable) head.push('#nullable enable', '');
    if (uses.date) head.push('using System;');
    if (uses.list) head.push('using System.Collections.Generic;');
    if (opts.attributes) head.push('using System.Text.Json.Serialization;');
    if (uses.date || uses.list || opts.attributes) head.push('');
    if (isRootArray) head.push('// The JSON root is an array: deserialize it as List<' + rootName + '>.', '');
    return { code: (head.length ? head.join('\n') + '\n' : '') + blocks.join('\n\n') + '\n', classes: classes.length };
  }
