// Builds /json-to-csharp, /json-to-java, /json-to-typescript index.html from shared pieces.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const INFER = read('lossless.js') + '\n' + read('infer.js');

const SAMPLE = `{
  "id": 1024,
  "orderNumber": "SO-2024-0042",
  "createdAt": "2024-05-17T09:30:00Z",
  "total": 149.95,
  "paid": true,
  "notes": null,
  "customer": {
    "id": 77,
    "first_name": "Maya",
    "last_name": "Lopez",
    "email": "maya@example.com",
    "address": { "street": "12 Harbor Rd", "city": "Porto", "zip": "4000-123" }
  },
  "items": [
    { "sku": "KB-01", "name": "Keyboard", "qty": 1, "unitPrice": 89.5 },
    { "sku": "MS-07", "name": "Mouse", "qty": 2, "unitPrice": 30.225, "discount": 0.1 }
  ],
  "tags": ["priority", "gift"]
}`;

function page(o) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${o.title}</title>
  <meta name="description" content="${o.desc}" />
  <meta name="keywords" content="${o.keywords}" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
  <link rel="canonical" href="/${o.route}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${o.ogTitle}" />
  <meta property="og:description" content="${o.ogDesc}" />
  <meta property="og:url" content="/${o.route}" />
  <meta property="og:site_name" content="DevTools" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${o.name}",
    "url": "/${o.route}",
    "description": "${o.ldDesc}",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Any",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "featureList": ${JSON.stringify(o.features)},
    "isAccessibleForFree": true
  }
  </script>
  <script type="application/ld+json">
  { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "/" },
    { "@type": "ListItem", "position": 2, "name": "${o.name}", "item": "/${o.route}" } ] }
  </script>
  <link rel="stylesheet" href="/assets/app.css" />
  <style>
    #input, #output { min-height: 420px; }
    #output { white-space: pre; overflow-wrap: normal; overflow-x: auto; }
    .options input[type=text] { width: 170px; }
    .fs-bar { display: flex; align-items: center; gap: 8px; }
    .fs-bar .panel-title { flex: 1; }
    .fs-overlay textarea { height: 100%; min-height: 0; border: none; background: transparent; white-space: pre; resize: none; }
    dialog.fs-overlay { width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; border: 0; color: var(--text); }
    dialog.fs-overlay::backdrop { background: var(--bg); }
  </style>
</head>
<body>
<div class="shell">
  <header id="site-header"></header>
  <aside id="sidebar"></aside>
  <div class="nav-backdrop"></div>

  <main class="page">
    <section class="tool-head">
      <h1>${o.h1}</h1>
      <p>${o.lead}</p>
    </section>

    <section class="options" aria-label="Options">
${o.optionsHtml}
    </section>

    <div class="msg" id="msg" hidden></div>

    <section class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">JSON input</span>
          <span class="panel-actions">
            <span class="panel-meta" id="in-meta"></span>
            <button class="btn sm" id="sample">Sample</button>
            <button class="btn sm" id="clear">Clear</button>
          </span>
        </div>
        <textarea id="input" spellcheck="false" placeholder='Paste a JSON object or an array of objects…'></textarea>
      </div>
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">${o.outTitle}</span>
          <span class="panel-actions">
            <span class="panel-meta" id="out-meta"></span>
            <button class="btn sm" id="fs" title="Fullscreen (Esc to close)" aria-label="Fullscreen ${o.outTitle}"><span aria-hidden="true">⛶</span> Fullscreen</button>
            <button class="btn sm" id="copy">Copy</button>
            <button class="btn sm" id="dl">Download <span class="no-caps">${o.ext}</span></button>
          </span>
        </div>
        <textarea id="output" spellcheck="false" readonly wrap="off"></textarea>
      </div>
    </section>

    <section class="about">
${o.about}
      <h2>Privacy</h2>
      <p>Code is generated entirely in your browser. The JSON you paste is never uploaded, stored or logged.</p>
    </section>
  </main>
</div>

<script src="/assets/tools.js"></script>
<script>
(function () {
  'use strict';
  const { $, $$, el, debounce, copy, download, msg } = DevTools;

  // ==CORE==
${INFER}
${o.core}
  // ==/CORE==

  const input = $('#input'), output = $('#output'), msgEl = $('#msg');
  const SAMPLE = ${JSON.stringify(SAMPLE)};

${o.readOpts}

  function run() {
    const text = input.value;
    $('#in-meta').textContent = text ? text.length.toLocaleString() + ' chars' : '';
    if (!text.trim()) { output.value = ''; $('#out-meta').textContent = ''; msg(msgEl, ''); DevTools.invalid(input, false); return; }
    try {
      const r = ${o.genCall};
      output.value = r.code;
      $('#out-meta').textContent = r.classes + ' ${o.unit}' + (r.classes === 1 ? '' : 's') + ' · ' + r.code.split('\\n').length + ' lines';
      msg(msgEl, '');
      DevTools.invalid(input, false);
    } catch (e) {
      output.value = '';
      $('#out-meta').textContent = '';
      const syntax = e instanceof SyntaxError;
      const where = syntax && typeof e.line === 'number' && e.pos >= 0 ? ' Line ' + e.line + ', column ' + e.col + '.' : '';
      msg(msgEl, 'error', (syntax ? '✗ Invalid JSON: ' : '✗ ') + e.message + where);
      DevTools.invalid(input, syntax || /top-level JSON value/.test(e.message));
    }
  }
  const runSoon = debounce(run, 250);

  input.addEventListener('input', runSoon);
  $$('.options input, .options select').forEach(n => n.addEventListener(n.type === 'text' ? 'input' : 'change', runSoon));
  $('#clear').addEventListener('click', () => { input.value = ''; run(); input.focus(); });
  $('#sample').addEventListener('click', () => { input.value = SAMPLE; run(); });
  $('#copy').addEventListener('click', e => { if (output.value) copy(output.value, e.currentTarget); });
  $('#dl').addEventListener('click', () => { if (output.value) download(${o.fileNameExpr}, output.value); });

  // fullscreen: native modal dialog (inert background, Esc closes, focus returns to the opener)
  let dlg = null;
  $('#fs').addEventListener('click', e => {
    if (dlg) return;
    const opener = e.currentTarget;
    const ta = el('textarea', { readonly: true, spellcheck: 'false', wrap: 'off', 'aria-label': 'Generated code' });
    ta.value = output.value;
    const closeBtn = el('button', { class: 'btn sm', onclick: () => dlg.close() }, 'Close (Esc)');
    dlg = el('dialog', { class: 'fs-overlay', 'aria-label': '${o.outTitle} fullscreen' },
      el('div', { class: 'fs-bar' },
        el('span', { class: 'panel-title' }, '${o.outTitle}'),
        el('button', { class: 'btn sm', onclick: ev => copy(output.value, ev.currentTarget) }, 'Copy'),
        closeBtn),
      el('div', { class: 'fs-body' }, ta));
    dlg.addEventListener('close', () => {
      dlg.remove(); dlg = null; document.body.style.overflow = '';
      if (opener.isConnected) opener.focus();
    });
    document.body.appendChild(dlg); document.body.style.overflow = 'hidden';
    dlg.showModal();
    closeBtn.focus();
  });
  // Ctrl/⌘+Enter regenerates immediately
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });

  run();
})();
</script>
</body>
</html>
`;
}

const pages = [
  {
    route: 'json-to-csharp', name: 'JSON to C#',
    title: 'JSON to C# Class Generator — Classes &amp; Records, Client-Side',
    desc: 'Convert JSON into C# classes or records with System.Text.Json attributes, nullable types, DateTime detection and PascalCase properties. Runs in your browser.',
    keywords: 'json to c#, json to csharp, json to c# class, json to c# record, generate c# class from json, system.text.json',
    ogTitle: 'JSON to C# — Classes and Records from JSON',
    ogDesc: 'Paste JSON, get C# classes or records. Nothing leaves your machine.',
    ldDesc: 'Free online JSON to C# converter generating classes or records with JsonPropertyName attributes. Runs client-side.',
    features: ['C# classes or records', 'JsonPropertyName attributes', 'Nullable types', 'DateTime detection', 'Nested classes and List<T>', 'Client-side only'],
    h1: 'JSON to C#', lead: 'Generate C# classes or records from a JSON sample.',
    outTitle: 'C# code', ext: '.cs', unit: 'type',
    optionsHtml: `      <label class="opt"><span class="opt-label">Class name</span><input type="text" id="cls" value="RootObject" spellcheck="false" /></label>
      <span class="divider"></span>
      <label class="check"><input type="checkbox" id="records" /> Use records</label>
      <label class="check"><input type="checkbox" id="nullable" /> Nullable types</label>
      <label class="check"><input type="checkbox" id="attrs" checked /> [JsonPropertyName]</label>
      <label class="check"><input type="checkbox" id="pascal" checked /> PascalCase properties</label>
      <label class="check"><input type="checkbox" id="dates" checked /> Detect DateTime</label>`,
    readOpts: `  function opts() {
    return { className: $('#cls').value.trim() || 'RootObject', records: $('#records').checked, nullable: $('#nullable').checked,
      attributes: $('#attrs').checked, pascal: $('#pascal').checked, dates: $('#dates').checked };
  }`,
    genCall: 'generateCSharp(text, opts())',
    fileNameExpr: `(toPascal($('#cls').value) || 'RootObject') + '.cs'`,
    core: read('gen-cs.js'),
    about: `      <h2>About this tool</h2>
      <p>Paste a representative JSON document and get C# types that <code>System.Text.Json</code> can deserialize it into. Every nested object becomes its own class (or record), arrays become <code>List&lt;T&gt;</code>, and when the root is an array of objects the item type is generated.</p>
      <h2>Type mapping</h2>
      <ul>
        <li>Whole numbers → <code>int</code>, <code>long</code> outside the 32-bit range, <code>ulong</code> for positive values beyond <code>long</code>, and <code>decimal</code> beyond 64 bits. A number written with a decimal point or exponent (<code>2.0</code>, <code>1e3</code>) → <code>double</code>.</li>
        <li><code>true/false</code> → <code>bool</code>; text → <code>string</code>; valid ISO-8601 dates such as <code>2024-05-17</code> or <code>2024-05-17T09:30:00Z</code> → <code>DateTime</code> (optional; impossible dates like <code>2024-02-30</code> stay <code>string</code>).</li>
        <li><code>null</code>-only values, empty arrays and mixed-type arrays → <code>object</code>.</li>
        <li>A value type that is <code>null</code> in any sample always becomes nullable (<code>int?</code>, <code>DateTime?</code>), since deserializing <code>null</code> into <code>int</code> fails. With <em>Nullable types</em> on, properties missing from some items and reference types are marked nullable too.</li>
      </ul>
      <h2>Options</h2>
      <p><strong>Use records</strong> emits positional records (attributes use the <code>property:</code> target). <strong>PascalCase properties</strong> renames <code>first_name</code> to <code>FirstName</code>; keep <strong>[JsonPropertyName]</strong> on so the original JSON names still map.</p>`,
  },
  {
    route: 'json-to-java', name: 'JSON to Java',
    title: 'JSON to Java Class Generator — POJOs, Records, Jackson',
    desc: 'Turn JSON into Java POJOs or records with optional Lombok @Data, Jackson @JsonProperty annotations, getters and setters. Runs entirely in your browser.',
    keywords: 'json to java, json to pojo, json to java class, json to java record, jackson jsonproperty, lombok data',
    ogTitle: 'JSON to Java — POJOs and Records from JSON',
    ogDesc: 'Generate Java classes or records from JSON in your browser. Nothing leaves your machine.',
    ldDesc: 'Free online JSON to Java converter generating POJOs or records with Lombok and Jackson options. Runs client-side.',
    features: ['Java POJOs or records', 'Jackson @JsonProperty', 'Lombok @Data', 'Getters and setters', 'Nested static classes and List<T>', 'Client-side only'],
    h1: 'JSON to Java', lead: 'Generate Java classes or records from a JSON sample.',
    outTitle: 'Java code', ext: '.java', unit: 'class',
    optionsHtml: `      <label class="opt"><span class="opt-label">Class name</span><input type="text" id="cls" value="Root" spellcheck="false" /></label>
      <label class="opt"><span class="opt-label">Package</span><input type="text" id="pkg" value="com.example.model" spellcheck="false" /></label>
      <span class="divider"></span>
      <label class="check"><input type="checkbox" id="records" /> Records</label>
      <label class="check"><input type="checkbox" id="lombok" /> Lombok @Data</label>
      <label class="check"><input type="checkbox" id="jackson" checked /> Jackson @JsonProperty</label>
      <label class="check"><input type="checkbox" id="accessors" checked /> Getters / setters</label>`,
    readOpts: `  function opts() {
    const records = $('#records').checked, lombok = $('#lombok').checked;
    // Lombok and accessors do not apply to records; Lombok replaces hand-written accessors.
    $('#lombok').disabled = records;
    $('#accessors').disabled = records || lombok;
    return { className: $('#cls').value.trim() || 'Root', packageName: $('#pkg').value, records, lombok,
      jackson: $('#jackson').checked, accessors: $('#accessors').checked };
  }`,
    genCall: 'generateJava(text, opts())',
    fileNameExpr: `(toPascal($('#cls').value) || 'Root') + '.java'`,
    core: read('gen-java.js'),
    about: `      <h2>About this tool</h2>
      <p>Paste a JSON sample and get a single compilable <code>.java</code> file: the root class plus every nested object as a <code>public static</code> inner class (or nested record). When the root is an array of objects, the item type is generated.</p>
      <h2>Type mapping</h2>
      <ul>
        <li>Whole numbers → <code>Integer</code>, <code>Long</code> outside the 32-bit range, <code>BigInteger</code> beyond 64 bits; numbers with a decimal point or exponent → <code>Double</code>.</li>
        <li><code>true/false</code> → <code>Boolean</code>; text → <code>String</code>; arrays → <code>List&lt;T&gt;</code>.</li>
        <li><code>null</code>-only values, empty arrays and mixed arrays → <code>Object</code>.</li>
        <li>Field names are camelCased; Java keywords and names of <code>Object</code> methods (<code>hashCode</code>, <code>toString</code>, <code>getClass</code>, <code>wait</code>…) get a trailing underscore. Keep <strong>Jackson</strong> on so the original JSON names still map.</li>
      </ul>
      <h2>Options</h2>
      <p><strong>Records</strong> (Java 16+) produce immutable records, so Lombok and accessors are disabled. <strong>Lombok @Data</strong> generates accessors at compile time instead of writing them out.</p>`,
  },
  {
    route: 'json-to-typescript', name: 'JSON to TypeScript',
    title: 'JSON to TypeScript — Interfaces &amp; Type Aliases, Client-Side',
    desc: 'Generate TypeScript interfaces or type aliases from JSON, with optional properties, union types for mixed arrays and camelCase names. Runs in your browser.',
    keywords: 'json to typescript, json to ts, json to interface, typescript interface generator, json to type',
    ogTitle: 'JSON to TypeScript — Interfaces from JSON',
    ogDesc: 'Paste JSON, get TypeScript interfaces or types. Nothing leaves your machine.',
    ldDesc: 'Free online JSON to TypeScript converter generating interfaces or type aliases. Runs client-side.',
    features: ['Interfaces or type aliases', 'Optional properties', 'Union types for mixed arrays', 'Nested interfaces', 'camelCase or original names', 'Client-side only'],
    h1: 'JSON to TypeScript', lead: 'Generate TypeScript interfaces or type aliases from a JSON sample.',
    outTitle: 'TypeScript', ext: '.ts', unit: 'type',
    optionsHtml: `      <label class="opt"><span class="opt-label">Root name</span><input type="text" id="cls" value="Root" spellcheck="false" /></label>
      <span class="divider"></span>
      <label class="opt"><span class="opt-label">Declare as</span><select id="kind"><option value="interface">interface</option><option value="type">type alias</option></select></label>
      <label class="opt"><span class="opt-label">Names</span><select id="naming"><option value="keep">Keep original</option><option value="camel">camelCase</option></select></label>
      <span class="divider"></span>
      <label class="check"><input type="checkbox" id="optional" /> All properties optional (?)</label>
      <label class="check"><input type="checkbox" id="export" checked /> export</label>`,
    readOpts: `  function opts() {
    return { rootName: $('#cls').value.trim() || 'Root', useType: $('#kind').value === 'type', optional: $('#optional').checked,
      exportKw: $('#export').checked, naming: $('#naming').value };
  }`,
    genCall: 'generateTypeScript(text, opts())',
    fileNameExpr: `(toCamel($('#cls').value) || 'root') + '.ts'`,
    core: read('gen-ts.js'),
    about: `      <h2>About this tool</h2>
      <p>Paste a JSON sample and get TypeScript declarations for it. Every nested object becomes its own interface (or type alias) named after its key, and arrays become <code>T[]</code>.</p>
      <h2>Type mapping</h2>
      <ul>
        <li>Numbers → <code>number</code>, text → <code>string</code>, <code>true/false</code> → <code>boolean</code>, <code>null</code> → <code>null</code>.</li>
        <li>Empty arrays → <code>unknown[]</code>; arrays with mixed values → unions such as <code>(string | number)[]</code>.</li>
        <li>Objects inside arrays are merged: a key missing from some items is marked optional (<code>?</code>), a key that is sometimes <code>null</code> gets <code>| null</code>.</li>
        <li>Keys that are not valid identifiers (e.g. <code>first-name</code>, or the empty key <code>""</code>) are quoted.</li>
      </ul>
      <h2>Options</h2>
      <p><strong>All properties optional</strong> adds <code>?</code> everywhere, useful for partial payloads. <strong>camelCase</strong> renames keys — only use it when your code maps names, since the types will no longer match the raw JSON.</p>`,
  },
];

for (const p of pages) {
  const out = path.join(ROOT, p.route, 'index.html');
  fs.writeFileSync(out, page(p));
  console.log('wrote', out);
}
