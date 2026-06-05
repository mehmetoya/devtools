# DevTools — Free, Private, Client-Side Developer Tools

A growing collection of free online developer utilities. Every tool runs entirely in your browser — no data is sent to any server, stored, or logged.

**Live site:** `https://`

---

## Tools

| Tool | Status | Path |
|---|---|---|
| JSON Formatter | ✅ Live | `/json-formatter` |
| Base64 Encode/Decode | 🔜 Planned | `/base64` |
| URL Encoder/Decoder | 🔜 Planned | `/url-encoder` |
| Regex Tester | 🔜 Planned | `/regex-tester` |

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
The output panel uses `textContent` exclusively — `innerHTML` is never used on user-supplied data. The syntax highlighter builds DOM nodes with `document.createElement` + `textContent`, never string concatenation into HTML. This makes it structurally impossible for a malicious JSON payload to execute code.

### Content Security Policy
All pages are served with a strict `Content-Security-Policy` header:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'none';        ← blocks all outbound network from JS
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';    ← prevents clickjacking
```

`connect-src 'none'` is the key line: even if malicious JS somehow ran, it could not exfiltrate data over the network.

### Additional headers
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## Project structure

```
/
├── index.html              ← Site root (redirects to /json-formatter)
├── json-formatter/
│   └── index.html          ← JSON Formatter tool
├── _headers                ← Netlify HTTP response headers
├── netlify.toml            ← Netlify routing + build config
└── README.md
```

Adding a new tool:

1. Create a folder: `mkdir base64`
2. Add `base64/index.html`
3. Uncomment the relevant `[[redirects]]` block in `netlify.toml`
4. Add the nav link in all existing tool pages

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

No build step. No `npm install`. No Node.js required. Pure static files — open `index.html` directly in a browser for local development.

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
