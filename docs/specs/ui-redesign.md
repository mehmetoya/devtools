# Spec: "Teknik Çizim" arayüzü

Durum: **onaylandı (2026-11-21)**. Kaynak: [docs/ideas/ui-redesign.md](../ideas/ui-redesign.md). Referans taslak: üç yönlü mockup (Teknik çizim yönü seçildi).

## Varsayımlar ve kararlar
1. **Kapsam dökümü gerekmiyor.** Bu tek bir yetenek, yani bir görsel sistem ve bir kabuk. Ayrı bir kapsam haritası çıkarılmayacak; parçalar planda dilimlenecek.
2. **Sayfaların iskeleti korunur.** Araç sayfalarının HTML yapısı (`.tool-head`, `.options`, `.grid-2`, `.panel`, `.about`) olduğu gibi kalır. Yeniden tasarım `assets/app.css` ve `assets/tools.js` üzerinden yapılır. 28 sayfanın gövdesine dokunmak yalnız gerektiği yerde yapılır, örneğin seçenek satırındaki etiketler için.
3. **Fontlar değişir.** Syne kaldırılır. Başlıklar ve etiketler için IBM Plex Sans Condensed (500/600), veri ve arayüz için IBM Plex Mono (400/500) kullanılır. Uzun düzyazı ("About" bölümleri) için IBM Plex Sans (400) eklenir (**karar**); tamamı mono olan düzyazı yorucu oluyor. Hepsi latin ve latin-ext alt kümeleriyle, woff2 formatında, self-hosted olur.
4. **Zemin tonu:** Saf kömür, `#0e1318`. Serif kullanılmaz. **Karar.**
5. **İmza:** Antet kutusunda "Drawn by M. Oya" yazar, kolofonda GitHub bağlantısıyla birlikte "mehmetoya". **Karar.**
6. **Ana sayfa:** Üstte büyük bir "Find a tool" alanı, altında 28 paftalık bir dizin (numara, ad ve tek satırlık açıklama ile kategori bölümleri). **Karar.**
7. **Revizyon tarihi:** Antet kutusundaki revizyon tarihi, registry'de araç başına elle girilen `rev` alanından gelir. Build tarihi kullanılmaz, çünkü `check.mjs` üreteçleri tekrar çalıştırıp çıktıyı karşılaştırıyor; değişen bir tarih bu kontrolü her seferinde bozardı.

## Hedef
Site, sahibinin günlük işini hızlandıran ve gören kişinin "bunu kim yaptı?" diye soracağı, imzalı bir atölye olmalı. Bunu 28 paftalık bir teknik çizim seti diliyle yapar: araç adı, pafta numarası, revizyon ve "Drawn by" bilgilerini taşıyan bir antet kutusu, komut paleti ve kolofon.

**Kullanıcı hikâyeleri**
- Sahibi olarak `/` veya ⌘K tuşuna basar, birkaç harf yazar ve Enter ile istediğim araca geçerim; fare kullanmam.
- Sahibi olarak favorilerimi listenin en üstünde görürüm ve `g` ardından `1`–`9` kısayoluyla açarım.
- Ziyaretçi olarak her sayfada kimin yaptığını antet kutusundan ve kolofondan anlarım.
- Klavye ve ekran okuyucu kullanıcısı olarak bugünkü erişilebilirlik düzeyini kaybetmem.

## Teknoloji
Statik HTML, CSS ve vanilla JS kullanılır; bundler yoktur. Node 22, yalnız üreteçler ve kontroller için gerekir. Netlify, publish dizini `.`. Vendor dosyaları (mermaid, DOMPurify, marked, qrcode) değişmez. Yeni npm bağımlılığı eklenmez.

## Komutlar
```
Üret:      node scripts/json-codegen/build-gen-pages.js && node scripts/gen-site.mjs
Kapı:      node scripts/check.mjs
Yerel:     node scripts/serve.mjs . 8888        # _headers CSP'sini ve netlify.toml 404 kurallarını uygular
Smoke:     node scripts/smoke.mjs <deploy-preview-url>
Tarama:    node scripts/scan.mjs http://127.0.0.1:8888   # CDP: CSP ihlali, konsol hatası, taşma, font baytları
```

## Proje yapısı (değişenler)
```
assets/app.css         → token'lar, doku (ızgara), bileşenler; baştan yazılır
assets/tools.js        → kabuk: header, sidebar, komut paleti, kısayollar, antet kutusu, kolofon
assets/fonts/          → Plex Sans Condensed + Plex Sans eklenir, Syne silinir, LICENSE dosyaları güncellenir
index.html, 404.html   → gen-site.mjs üretir; yeni ana sayfa düzeni
scripts/gen-site.mjs   → ana sayfa şablonu; gizli yollara /docs/* eklenir; robots.txt'ye Disallow: /docs/
scripts/check.mjs      → yeni kontroller (aşağıda)
scripts/smoke.mjs      → font yolları güncellenir; /docs/ideas/ui-redesign.md için 404 beklenir
scripts/serve.mjs      → yeni (scratchpad'den alınır)
scripts/scan.mjs       → yeni (Chrome DevTools Protocol; bağımlılık yok)
docs/                  → ideas/, specs/; Netlify'da 404 döner
```

## Görsel sistem
| Token | Değer | Not |
|---|---|---|
| `--bg` | `#0e1318` | saf kömür |
| `--paper` | `#121920` | panel zemini |
| `--ink` | `#dbe3ea` | ana metin |
| `--muted` | `#8796a5` | `--bg` üzerinde ≥4.5:1 olmalı |
| `--line` / `--line2` | `rgba(150,180,210,.13)` / `.38` | ızgara çizgisi / panel kenarı; kontrol kenarı ≥3:1 |
| `--accent` | `#ff7a45` | "kırmızı kalem"; tek vurgu rengi |
| `--danger` / `--warn` / `--ok` | ölçülerek seçilir | bilgi yalnız renkle verilmez, ikon ve metin de eklenir |
| `--radius` | `0` | teknik çizimde köşe yok |

- **Izgara:** 24 px'lik ince ve 120 px'lik ana çizgiler; `body` arka planında `background-image` ile çizilir. Panel ve metin alanı zeminleri opaktır, böylece ızgara metnin arkasına geçmez. `prefers-contrast: more` ve `forced-colors: active` durumlarında ızgara kapanır.
- **Panel:** 1 px'lik kenar ve köşe işaretleri (`::before` / `::after`). Panel başlıkları `A — INPUT`, `B — OUTPUT` biçiminde, harf vurgu renginde.
- **Sidebar:** numaralı liste (`01`, `02`…). Aktif araçta vurgu çizgisi ve `aria-current="page"` bulunur.
- **Antet kutusu:** Her araç sayfasında `.about` bölümünden önce yer alır. Hücreler: Tool, Sheet `NN / 28`, Rev., Drawn by, Scale `1 : 1`, Runs `Client-only`. Yalnız sunum amaçlıdır: bir `<dl>`, `aria-label="Drawing title block"`.
- **Kolofon:** Tüm sayfalarda bulunur: Made by hand by mehmetoya (GitHub bağlantısı), kullanılan fontlar, "No trackers · no server · CSP-locked" ve revizyon.
- **Hareket:** Yalnız odak ve hover geçişleri (≤120 ms) kullanılır. `prefers-reduced-motion` açıksa geçiş yoktur.

## Komut paleti
- **Açılış:** ⌘K / Ctrl+K her zaman çalışır. `/` tuşu, odak bir alanda (input, textarea, select, contenteditable) değilken çalışır. Mobilde header'daki "Find a tool" düğmesi kullanılır.
- **Yapı:** Native `<dialog>` (modal). İçinde `role="combobox"` olan bir input bulunur ve `aria-expanded`, `aria-controls`, `aria-activedescendant` taşır. Sonuçlar `role="listbox"` içinde, her biri `role="option"` ve `aria-selected` ile.
- **Arama:** Araç adı, kategori ve takma adlar (registry'ye `aliases` alanı eklenir, örneğin "b64", "uuid", "sha") içinde, büyük-küçük harfe ve aksana duyarsız arama yapılır. Sıralama: önce favoriler, sonra ad başlangıcı eşleşmesi, sonra içerik eşleşmesi.
- **Tuşlar:** ↑/↓ seçimi değiştirir, Enter `location.assign` ile aracı açar, Esc paleti kapatır ve odağı paleti açan öğeye geri verir. Sonuç sayısı canlı bölgeden duyurulur ("5 tools").
- **Mevcut `/` davranışı:** Bugün `/` tuşu sidebar aramasına odaklanıyor. Bu davranış paletin yerine geçmez, palet onu devralır. Sidebar arama kutusu kaldırılır, çünkü işini palet yapıyor.
- **WCAG 2.1.4:** Tek tuşla çalışan kısayollar (`/` ve `g`+rakam) sidebar altındaki "Keyboard shortcuts: on/off" anahtarıyla kapatılabilir. Ayar `localStorage`'da tutulur ve okuma ile yazma `try` içinde yapılır.

## Favoriler
- Mevcut `devtools:favorites` anahtarı korunur, böylece kullanıcının kayıtlı favorileri kaybolmaz.
- Sidebar'da favoriler en üstte durur, yanlarında `g1`…`g9` kısayol ipuçları görünür.
- `g` tuşuna basıldıktan sonra 1 saniye içinde bir rakam gelirse ilgili favori açılır.

## Kod stili
Mevcut desen sürer: user verisi yalnız `textContent` ve `value` ile yazılır; DOM `el()` ile kurulur; `innerHTML` kullanılmaz.
```js
const cell = (label, value, cls) =>
  el('div', { class: cls || '' }, el('dt', {}, label), el('dd', {}, value));
const block = el('dl', { class: 'titleblock', 'aria-label': 'Drawing title block' },
  cell('Tool', tool.name), cell('Sheet', `${pad(n)} / ${total}`), cell('Rev.', tool.rev),
  cell('Drawn by', 'M. Oya', 'sig'), cell('Scale', '1 : 1'), cell('Runs', 'Client-only'));
```
CSS'te renk değeri yalnız `:root` token'larında yazılır; bileşenler `var(--…)` kullanır. Yorumlar İngilizce yazılır, kodun mevcut dili korunur.

## Test stratejisi
Projede unit test çatısı yok ve eklenmeyecek. Doğrulama dört katmanda yapılır:
1. **`check.mjs` (build kapısı).** Mevcut kontrollere ek olarak:
   - (a) Tüm sayfalarda Syne referansı kalmamalı; `@font-face` ile tanımlanan her dosya diskte bulunmalı.
   - (b) Registry'deki her aracın `rev` alanı `YYYY.MM.DD` biçiminde olmalı.
   - (c) Palet için her aracın en az bir benzersiz arama önekiyle ilk sırada gelmesi garanti olmalı. Kontrol, aynı sıralama fonksiyonu `vm` içinde çalıştırılarak yapılır.
   - (d) Kontrast: `:root` token'larından metin çiftleri ≥4.5:1, kenarlıklar ≥3:1 olmalı; hesap script ile yapılır.
   - (e) `/docs/*` gizli yollar listesinde olmalı.
   - Her yeni kontrolün kırmızı yanabildiği, kasıtlı bozulmuş bir kopyayla gösterilecek.
2. **`scan.mjs` (puppeteer).** 30 sayfa, 375 px ve 1280 px genişlikte taranır. Beklenen: sıfır CSP ihlali, sıfır konsol hatası, sıfır yatay taşma. Ayrıca her sayfada palet `/` ile açılıp kapanmalı ve odak geri dönmeli.
3. **Manuel klavye ve ekran okuyucu turu (VoiceOver + Safari).** Kontrol edilenler: skip link, palet, favori kısayolları, mobil çekmece, odak görünürlüğü. QA Odası'nın A-01…A-09 düzeltmeleri gerilememeli.
4. **`smoke.mjs`:** Deploy preview ve production üzerinde çalışır.

## Sınırlar
- **Her zaman:**
  - commit'ten önce üreteçler ve `check.mjs` çalıştırılır;
  - user verisi `textContent` ile yazılır;
  - yeni inline script, hash'i `gen-site.mjs` tarafından üretilerek eklenir;
  - her UI değişikliği 375 px'te de kontrol edilir;
  - oda denetimleri (Designers → QA → Ops) yayından önce yapılır.
- **Önce sor:**
  - font dosyalarının indirilmesi (@fontsource paketlerinden, sürüm ve sha256 kaydıyla);
  - `npx puppeteer` kullanımı;
  - URL değişikliği;
  - sayfa gövdelerinde toplu değişiklik;
  - `main` dalına push veya merge.
- **Asla:**
  - `'unsafe-inline'` kapsamının `/html-viewer` dışına genişletilmesi;
  - üçüncü taraf font, CDN veya analytics kullanımı;
  - `innerHTML` ile kullanıcı verisi yazılması;
  - araç mantığının değiştirilmesi;
  - `assets/vendor/` içinde değişiklik.

## Başarı ölçütleri
1. 28 aracın her biri, herhangi bir sayfadan `/` (veya ⌘K) + en fazla 4 karakter + Enter ile açılır. Bu, `check.mjs` (c) ve `scan.mjs` ile doğrulanır.
2. Favoriler `g1`–`g9` ile açılır. Kısayollar kapatılabilir ve kapatıldığında `/` ile `g` hiçbir şey yapmaz; ⌘K çalışmaya devam eder.
3. Her araç sayfasında antet kutusu (doğru pafta numarası ve rev ile) ve kolofon bulunur. Ana sayfada ve 404 sayfasında kolofon bulunur.
4. Siteden Syne kaldırılmıştır. İlk yüklemede indirilen font baytları bugünkünden fazla değildir (ölçüm 2026-11-21: ana sayfada 5 dosya, 72.763 bayt).
5. `check.mjs` yeşil yanar. `scan.mjs` iki genişlikte de sıfır ihlal, hata ve taşma bulur. `smoke.mjs` preview'da ve production'da yeşil yanar.
6. Kontrast: tüm metin token çiftleri ≥4.5:1, kontrol kenarları ≥3:1. Izgara açıkken bile metin alanlarının zemini opaktır.
7. `prefers-reduced-motion`, `prefers-contrast: more` ve `forced-colors` altında arayüz kullanılabilir ve ızgara kapalıdır.
8. `/docs/…` yolları Netlify'da 404 döner.
9. Ziyaretçi testi (manuel): 3 kişiden en az 2'si "bunu kim yapmış?" sorusunu sayfadan cevaplar.

## Açık sorular
1. **Rev tarihleri:** Başlangıçta tüm araçlara `2026.11.21` yazılması varsayıldı. Sonraki değişikliklerde tarih araç bazında elle güncellenir.

Çözülenler (2026-11-21): zemin saf kömür; imza "M. Oya"; ana sayfa pafta dizini; düzyazı için IBM Plex Sans eklenir.
