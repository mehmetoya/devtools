# DevTools — Free, Private, Client-Side Developer Tools

A growing collection of free online developer utilities. Every tool runs entirely in your browser — no data is sent to any server or logged. The only thing kept is local to your browser: favorites and the last draft of the Markdown, HTML and Diagram viewers (localStorage).

**Live site:** https://tool.mehmetoya.com

---

## Tools

| Category | Tools |
|---|---|
| Text | Case Converter, String Reverse, Trim / Pad, Line Counter, Line Operations, String Compare |
| Encode / Decode | Base64, URL Encode, Hash Generator (MD5/SHA/HMAC), JWT Tool |
| JSON | JSON Formatter, JSON Compare, JSON → C#, JSON → Java, JSON → TypeScript |
| Regex | Regex Search, Regex Replace, String Extract |
| Developer | DateTime Formatter, String Formatter, GUID Generator, Password Generator, Number Converter, Barcode/QR Generator, HTTP Client |
| Viewers | Markdown Viewer, HTML Viewer (sandboxed), Diagram Viewer (Mermaid) |

Each tool lives at `/<route>` (folder `<route>/index.html`). The registry of tools is in `assets/tools.js`.

---

## Why another developer tool site?

Most online JSON formatters and similar tools save your pastes to a public URL, log your data server-side, or expose it through an enumerable "recent links" feed. In June 2026, security researchers at BeyondMemory [documented](https://beyondmemory.io/blog/json-formatter-data-exposure) seven years of sensitive data — TCKNs, IBANs, payment card numbers, API keys, and production secrets — sitting publicly accessible on `jsonformatter.org`. The same research found a stored XSS vulnerability in the formatter itself.

This project is a direct response to that pattern. The design principle is simple: **the tool should never know what you pasted.**

---

## Security model

### No backend
There is no server, no database, no API. The site is 100% static HTML/CSS/JS deployed on Netlify. Nothing to breach.

### No save / share / recent links
These features are intentionally absent. They are the primary data-exposure vector in existing tools.

### XSS prevention
Tools write user data with `textContent` / `.value` only. There are exactly three reviewed HTML sinks, each allow-listed by `scripts/check.mjs`: the Markdown preview (DOMPurify-sanitized), the Mermaid SVG (`securityLevel: 'strict'`), and the HTML viewer's `srcdoc` (an `<iframe sandbox="allow-scripts">` with an opaque origin). The syntax highlighter builds DOM nodes with `document.createElement` + `textContent`, never string concatenation into HTML. This makes it structurally impossible for a malicious JSON payload to execute code.

### Content Security Policy
All pages are served with a strict `Content-Security-Policy` header:

```
default-src 'self';
script-src 'self' 'sha256-…';   ← only this page's own inline scripts, by hash (no 'unsafe-inline')
style-src 'self' 'unsafe-inline';
font-src 'self';                ← fonts are self-hosted, no third-party requests
img-src 'self' data:;
connect-src 'none';             ← blocks fetch/XHR/WebSocket from JS
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';         ← prevents clickjacking
```

Hash-based `script-src` means injected markup cannot run handlers or scripts, and `connect-src 'none'` stops page scripts from opening network connections. The same policy is also embedded as a `<meta>` tag in every page, so it applies to 404 responses too. Exception: the HTML viewer keeps `'unsafe-inline'` because its sandboxed preview runs the user's own inline scripts.

**Exception:** `/http-client` exists to send requests, so only that path gets `connect-src http: https:`. CSP is therefore set per path in `_headers` rather than on `/*` (Netlify merges overlapping rules, which would make the policy impossible to relax for one page).

### Additional headers
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## Project structure

```
/
├── index.html              ← Home page (generated)
├── 404.html                ← Not-found page (generated)
├── assets/
│   ├── app.css             ← Shared styles
│   ├── tools.js            ← Tool registry, header, sidebar (search + favorites), helpers
│   ├── fonts/              ← Self-hosted Syne + IBM Plex Mono (OFL)
│   ├── regex-worker.js     ← Runs user regexes off the main thread with a timeout
│   └── vendor/             ← Pinned third-party libs + VERSIONS.txt (versions, sources, sha256)
├── <route>/index.html      ← One folder per tool
├── scripts/gen-site.mjs    ← Generates index.html, 404.html, _headers, netlify.toml, sitemap.xml, robots.txt; syncs page heads + CSP hashes
├── scripts/json-codegen/   ← Generates the three JSON → code pages from shared inference code
├── scripts/check.mjs       ← Quality gate (Netlify build command)
├── scripts/smoke.mjs       ← Post-deploy smoke test against a live URL
├── _headers                ← Netlify HTTP response headers (generated)
├── netlify.toml            ← Netlify config (generated)
└── README.md
```

Adding a new tool:

1. Add it to `CATEGORIES` in `assets/tools.js`
2. Create `<route>/index.html` (copy `base64/index.html` as a template)
3. Run `node scripts/gen-site.mjs .` to regenerate the home page, headers and CSP hashes, then `node scripts/check.mjs`

---

## JSON Formatter — feature list

- **Beautify / Pretty Print** — indent with 2 spaces, 4 spaces, or tabs
- **Validate** — instant syntax validation with native `JSON.parse` error messages
- **Minify** — strip all whitespace for production payloads
- **Sort Keys** — sort object keys alphabetically at every nesting level
- **JSON → CSV** — convert a JSON array of objects to CSV
- **Syntax Highlighting** — keys, strings, numbers, booleans, null — all DOM text nodes, no innerHTML
- **Drag & Drop** — drop a `.json` file directly onto the editor
- **Download** — save formatted output as `.json` or `.csv`
- **Keyboard shortcuts** — `Ctrl+Enter` beautify · `Ctrl+M` minify · `Ctrl+K` clear
- **Stats** — total key count + max nesting depth

---

## Deployment

The site deploys automatically via Netlify on every push to `main`.

### Manual deploy (first time)

```bash
git clone https://github.com/mehmetoya/devtools.git
cd devtools

# make your changes, then:
git add .
git commit -m "your message"
git push origin main
```

Netlify picks up the push and deploys within ~30 seconds.

### Environment

No bundler and no `npm install`. Pages are plain static files, but asset paths are absolute (`/assets/...`), so serve the folder instead of opening files directly, e.g.:

```bash
npx serve .
```

Generated files — edit the generators, not the output:

```bash
node scripts/json-codegen/build-gen-pages.js   # json-to-csharp / java / typescript pages
node scripts/gen-site.mjs .                    # home, 404, _headers, netlify.toml, sitemap, robots, page <head>s + CSP hashes
node scripts/check.mjs                         # quality gate (also runs as the Netlify build command)
node scripts/smoke.mjs https://tool.mehmetoya.com   # post-deploy smoke test (or a deploy-preview URL)
```

Any edit to a page's inline `<script>` changes its CSP hash, so run `gen-site` afterwards (the check fails otherwise).

---

## SEO / GEO (AI Search)

Each tool page includes:

- Semantic HTML with `<main>`, `<section>`, `<aside>`, `aria-label` attributes
- `<title>` and `<meta name="description">` optimised per tool
- Open Graph + Twitter Card meta tags
- `application/ld+json` structured data — `WebApplication` schema for AI crawlers (ChatGPT, Perplexity, Google AI Overviews)
- `BreadcrumbList` schema for navigation context
- A visible content section below the tool with feature descriptions, usage instructions, and a privacy statement — readable by both humans and crawlers

---

## License

MIT — free to use, fork, and adapt.
