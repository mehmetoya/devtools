  /* ── Java generator ── */
  const JAVA_KEYWORDS = new Set(('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record yield').split(' '));
  const JAVA_RESERVED_TYPES = ['List', 'Object', 'String', 'Integer', 'Long', 'Double', 'Boolean', 'BigInteger', 'JsonProperty', 'Data'];
  // names that clash with java.lang.Object methods (a record component hashCode would override hashCode())
  const JAVA_OBJECT_METHODS = new Set(['hashCode', 'toString', 'getClass', 'clone', 'finalize', 'notify', 'notifyAll', 'wait']);

  /** opts: { className, packageName, records, lombok, jackson, accessors } */
  function generateJava(text, opts) {
    opts = Object.assign({ className: 'Root', packageName: 'com.example.model', records: false, lombok: false, jackson: true, accessors: true }, opts);
    const rootName = toPascal(opts.className) || 'Root';
    const pkg = String(opts.packageName || '').trim();
    if (pkg && !/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(pkg)) throw new Error('Invalid package name: ' + pkg);
    const { type } = analyze(text, {});
    const isRootArray = type.k === 'array';
    if (!(type.k === 'object' || (isRootArray && type.elem && type.elem.k === 'object'))) {
      throw new Error('The top-level JSON value must be an object or an array of objects.');
    }
    const classes = collectClasses(type, rootName, JAVA_RESERVED_TYPES, false);
    const useLombok = opts.lombok && !opts.records;
    const useAccessors = opts.accessors && !opts.records && !useLombok;
    let usesList = false, usesBig = false;

    function typeStr(t) {
      if (!t) return 'Object';
      switch (t.k) {
        case 'int': return 'Integer';
        case 'long': return 'Long';
        case 'ulong': case 'big': usesBig = true; return 'BigInteger';
        case 'double': return 'Double';
        case 'bool': return 'Boolean';
        case 'string': case 'date': return 'String';
        case 'object': return t.name;
        case 'array': usesList = true; return 'List<' + typeStr(t.elem) + '>';
        default: return 'Object';
      }
    }
    function fieldName(key, used) {
      let n = toCamel(key) || 'field';
      if (JAVA_KEYWORDS.has(n) || JAVA_OBJECT_METHODS.has(n)) n += '_';
      return uniqueName(n, used);
    }
    const cap = s => s.replace(/^_+/, '').replace(/^./, ch => ch.toUpperCase()) || 'Field';
    const ann = f => '@JsonProperty(' + JSON.stringify(f.key) + ')';

    function classLines(c, isRoot) {
      const used = new Set(), fields = [];
      for (const [key, f] of c.fields) fields.push({ key, name: fieldName(key, used), type: typeStr(f.type) });
      const nested = isRoot ? classes.filter(x => x !== c) : [];
      const lines = [];
      const mod = isRoot ? 'public ' : 'public static ';
      if (opts.records) {
        const kw = 'public record ';
        if (!fields.length) lines.push(kw + c.name + '() {');
        else {
          lines.push(kw + c.name + '(');
          fields.forEach((f, i) => lines.push('    ' + (opts.jackson ? ann(f) + ' ' : '') + f.type + ' ' + f.name + (i < fields.length - 1 ? ',' : '')));
          lines.push(') {');
        }
      } else {
        if (useLombok) lines.push('@Data');
        lines.push(mod + 'class ' + c.name + ' {');
        const vis = (useLombok || useAccessors) ? 'private ' : 'public ';
        fields.forEach(f => {
          lines.push('');
          if (opts.jackson) lines.push('    ' + ann(f));
          lines.push('    ' + vis + f.type + ' ' + f.name + ';');
        });
        if (useAccessors) fields.forEach(f => {
          const p = cap(f.name);
          lines.push('', '    public ' + f.type + ' get' + p + '() {', '        return ' + f.name + ';', '    }');
          lines.push('', '    public void set' + p + '(' + f.type + ' ' + f.name + ') {', '        this.' + f.name + ' = ' + f.name + ';', '    }');
        });
      }
      nested.forEach(n => { lines.push(''); classLines(n, false).forEach(l => lines.push(l ? '    ' + l : l)); });
      if (opts.records && !nested.length) lines[lines.length - 1] += '}';
      else lines.push('}');
      return lines;
    }

    const body = classLines(classes[0], true);
    const head = [];
    if (pkg) head.push('package ' + pkg + ';', '');
    const imports = [];
    if (usesBig) imports.push('import java.math.BigInteger;');
    if (usesList) imports.push('import java.util.List;');
    if (opts.jackson) imports.push('import com.fasterxml.jackson.annotation.JsonProperty;');
    if (useLombok) imports.push('import lombok.Data;');
    if (imports.length) head.push(...imports, '');
    if (isRootArray) head.push('// The JSON root is an array: deserialize it as List<' + rootName + '>.');
    return { code: (head.length ? head.join('\n') + '\n' : '') + body.join('\n') + '\n', classes: classes.length, fileName: rootName + '.java' };
  }
