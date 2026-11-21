# Görevler: "Teknik Çizim" arayüzü

Plan: [docs/plans/ui-redesign.md](../plans/ui-redesign.md) · Spec: [docs/specs/ui-redesign.md](../specs/ui-redesign.md)

Her görev için standart kapı, kabul kriterlerinin üstünde ortak "bitti" çizgisidir:

```
node scripts/json-codegen/build-gen-pages.js && node scripts/gen-site.mjs && node scripts/check.mjs
```

Bu komut yeşil yanmadan görev bitmiş sayılmaz.

---

## T1: `docs/` yolunu yayından gizle
**Açıklama:** `/docs/*` yolu Netlify'da 404 dönmeli ve robots tarafından taranmamalı. `check.mjs` bu kuralın kaldırılmasını yakalamalı.

**Kabul kriterleri:**
- [x] `gen-site.mjs` gizli yollar listesinde `/docs/*` var; `robots.txt` içinde `Disallow: /docs/` var.
- [x] `smoke.mjs`, `/docs/specs/ui-redesign.md` için 404 bekliyor.
- [x] `check.mjs` kontrol (e): `netlify.toml` içinde `/docs/*` 404 kuralı yoksa kapı başarısız oluyor. Bu, kuralı silinmiş bir kopyayla kanıtlanıyor.

**Doğrulama:** Standart kapı geçiyor; bozuk kopyada kapı kırmızı yanıyor.

**Bağımlılık:** Yok · **Dosyalar:** `scripts/gen-site.mjs`, `scripts/check.mjs`, `scripts/smoke.mjs` (`netlify.toml` ve `robots.txt` üretiliyor) · **Kapsam:** S

## T2: `serve.mjs` ve `scan.mjs`'i repoya al, bugünkü durumun ölçümünü al
**Açıklama:** Scratchpad'deki CSP uygulayan yerel sunucu `scripts/serve.mjs` olarak repoya alınır. Tarama betiği `scripts/scan.mjs` yazılır. Puppeteer yerine doğrudan Chrome DevTools Protocol kullanır; npm bağımlılığı ve npx gerekmez. Bugünkü sitenin ölçümü kaydedilir.

**Kabul kriterleri:**
- [x] `node scripts/serve.mjs . 8888`, `_headers` içindeki CSP'yi uyguluyor ve `/route` ile `/route/` adreslerini 200 ile döndürüyor.
- [x] `scan.mjs` 30 sayfayı 375 px ve 1280 px genişlikte tarıyor. Raporladıkları: CSP ihlali, konsol hatası, yatay taşma ve ilk yüklemede indirilen font baytları. Herhangi bir ihlalde çıkış kodu 1 oluyor.
- [x] Bugünkü ölçüm (font baytları ve tarama sonucu) plana yazıldı.

**Doğrulama:** Bugünkü sitede tarama temiz çıkıyor. Kasıtlı olarak eklenen bir inline script'i CSP ihlali olarak yakalıyor.

**Bağımlılık:** Yok · **Dosyalar:** `scripts/serve.mjs`, `scripts/scan.mjs`, `docs/plans/ui-redesign.md` · **Kapsam:** S

## T3: Yeni fontları self-host et
**Açıklama:** Yeni fontlar `assets/fonts/` altına eklenir:
- IBM Plex Sans Condensed 500/600 ve IBM Plex Sans 400, latin ve latin-ext;
- woff2 dosyaları `@fontsource` paketlerinden, indirmeden önce sorularak;
- OFL lisansları;
- sha256 değerleri `VERSIONS.txt` dosyasına.

Syne bu görevde silinmez; T10'da silinir.

**Kabul kriterleri:**
- [x] 6 yeni woff2 dosyası ve lisans dosyası diskte.
- [x] `check.mjs` kontrol (a), kısmen: `assets/fonts/VERSIONS.txt` içindeki sha256 değerleri dosyalarla eşleşiyor; tek bayt değişince kapı kırmızı yanıyor.

**Doğrulama:** Standart kapı geçiyor.

**Bağımlılık:** Yok · **Dosyalar:** `assets/fonts/*`, `scripts/check.mjs` · **Kapsam:** S

### Kontrol noktası 0
- [x] Standart kapı yeşil; `scan.mjs` temiz; ölçüm sonuçları plana yazıldı.

---

## T4: Token'lar, ızgara, tipografi ve kontrast kontrolü
**Açıklama:** `app.css` dosyasının `:root` bloğu spec'teki token tablosuyla değiştirilir. Ayrıca:
- `@font-face` kuralları yeni fontlara geçer;
- `body` arka planına ızgara eklenir; `prefers-contrast: more` ve `forced-colors` altında ızgara kapanır;
- başlıklar Plex Sans Condensed, veri Plex Mono, `.about` bölümü Plex Sans olur.

`check.mjs` kontrol (d) eklenir: `:root` içindeki metin ve zemin çiftleri için ≥4.5:1, kenarlıklar için ≥3:1.

**Kabul kriterleri:**
- [x] Tüm sayfalar yeni token'ları ve fontları kullanıyor; Syne'ye CSS referansı kalmadı.
- [x] Kontrast kontrolü yeşil yanıyor ve `--muted: #556` ile bozulmuş bir kopyada kırmızı yanıyor.
- [x] Metin alanlarının ve panellerin zemini opak; ızgara metnin arkasında görünmüyor.

**Doğrulama:** Standart kapı geçiyor; `scan.mjs` iki genişlikte de temiz; base64 sayfasının ekran görüntüsü.

**Bağımlılık:** T3 · **Dosyalar:** `assets/app.css`, `scripts/check.mjs`, `scripts/smoke.mjs` (font yolları) · **Kapsam:** M

## T5: Bileşenler
**Açıklama:** Mevcut sınıflar spec'teki görsel sisteme göre yeniden yazılır:
- `.panel`: köşe işaretleri, `A — `/`B — ` harfleri;
- `.options`, `.seg` (aktif olan `aria-pressed` ile), `.btn`, `.check`, `select`;
- `.msg` durumları (renk, ikon ve metin birlikte);
- `.about`, tablolar, `<dialog>`;
- 860 px altındaki mobil kurallar.

`prefers-reduced-motion` açıkken geçiş yok.

**Kabul kriterleri:**
- [x] Panel harfleri CSS ile ekleniyor ve erişilebilirlik ağacında görünmüyor (`content: "A — " / ""`).
- [x] Bilgi hiçbir yerde yalnız renkle verilmiyor; hata ve uyarı mesajlarında ikon ve metin de var.
- [x] Mevcut odak halkası, `[aria-invalid]` ve `.panel:focus-within` davranışları korunuyor.

**Doğrulama:** Standart kapı geçiyor; `scan.mjs` temiz; base64, json-formatter, compare ve markdown-viewer sayfalarının 375 ve 1280 px ekran görüntüleri.

**Bağımlılık:** T4 · **Dosyalar:** `assets/app.css` · **Kapsam:** M

### Kontrol noktası A: görsel sistem
- [ ] `scan.mjs` iki genişlikte temiz; kontrast kontrolü yeşil.
- [x] `designers-room`: görsel sistem denetimi (kontrast, ızgara, tipografi, 375 px). Bulgular düzeltildi.
- [ ] **Sahibiyle görsel inceleme.** Izgara yorucu mu? Ton doğru mu? Onaydan önce Aşama 2'ye geçilmez.

---

## T6: Komut paleti
**Açıklama:** Komut paleti `tools.js` içinde kurulur:
- native `<dialog>`, `role="combobox"` olan bir input ve `role="listbox"`;
- açma: ⌘K / Ctrl+K her zaman; `/` odak bir alanda değilken;
- tuşlar: ↑/↓ seçim, Enter aracı açar, Esc kapatır ve odağı geri verir;
- sonuç sayısı canlı bölgede duyurulur.

Registry'ye `aliases` alanı eklenir. `rankTools` saf bir fonksiyon olarak dışa açılır. Header'a "Find a tool" düğmesi eklenir. Sidebar araması bu görevde kalır, T7'de kaldırılır.

**Kabul kriterleri:**
- [x] `check.mjs` kontrol (c): 28 aracın her biri için, en fazla 4 karakterlik ve aracı ilk sıraya getiren bir sorgu var. Bu, `vm` içinde aynı `rankTools` fonksiyonu çalıştırılarak doğrulanıyor. Bir takma ad çakışması eklenince kapı kırmızı yanıyor.
- [x] Palet kapanınca odak açan öğeye dönüyor; açıkken arka plan inert; arama aksana duyarsız ("dönüştür" ile "donustur" aynı sonucu veriyor).
- [x] `scan.mjs` her sayfada `/` → yazı → Esc akışını deniyor ve odağın geri döndüğünü doğruluyor.

**Doğrulama:** Standart kapı geçiyor; `scan.mjs` temiz; VoiceOver ile kısa bir tur.

**Bağımlılık:** T5 · **Dosyalar:** `assets/tools.js`, `assets/app.css`, `scripts/check.mjs`, `scripts/scan.mjs` · **Kapsam:** M

## T7: Header, sidebar, favori kısayolları ve kısayol anahtarı
**Açıklama:**
- Header yeni yerleşime geçer: marka, "Find a tool" düğmesi ve pafta sayacı.
- Sidebar'da numaralı liste ve `aria-current` kullanılır. Favoriler en üstte durur, yanlarında `g1`…`g9` ipuçları görünür. Sidebar arama kutusu kaldırılır.
- `g` ardından rakam kısayolu eklenir (1 saniye penceresi).
- "Keyboard shortcuts: on/off" anahtarı eklenir (WCAG 2.1.4). Ayar `localStorage`'da tutulur, erişim `try` içinde yapılır.
- Mobil çekmece davranışı korunur: `inert`, Esc ve odak.

**Kabul kriterleri:**
- [x] Mevcut `devtools:favorites` kayıtları değişmeden görünüyor.
- [x] Kısayollar kapalıyken `/` ve `g1` hiçbir şey yapmıyor, ⌘K çalışıyor. Odak bir alandayken tek tuşlu kısayollar hiçbir zaman tetiklenmiyor.
- [x] 375 px'te çekmece açılıyor ve kapanıyor; açıkken `main` inert oluyor.

**Doğrulama:** Standart kapı geçiyor; `scan.mjs` temiz; fare kullanmadan klavye turu.

**Bağımlılık:** T6 · **Dosyalar:** `assets/tools.js`, `assets/app.css` · **Kapsam:** M

### Kontrol noktası B: klavye
- [x] Fare kullanmadan tam tur: ana sayfa → palet → araç → favori kısayolu → skip link → mobil çekmece.
- [x] QA Odası'nın A-01…A-09 düzeltmelerinde gerileme yok (tek tek kontrol edilir).
- [x] `developers-room`: palet, kısayollar, favoriler, `tools.js`, `serve.mjs`, `scan.mjs`. Bulgular düzeltildi.
- [x] `security-audit` (yönlendirmeli mod, `CLIENT-SIDE.md`): kabuk DOM sink'leri, `localStorage`, klavye olayları, CSP değişmezleri, `serve.mjs` path traversal. Bulgular düzeltildi.

---

## T8: Antet kutusu ve kolofon
**Açıklama:**
- Registry'ye `rev` alanı eklenir; başlangıçta tüm araçlarda `2026.11.21`.
- `tools.js` her araç sayfasında `.about` bölümünden önce bir antet kutusu ekler: `<dl>` ile Tool, Sheet `NN / 28`, Rev., "Drawn by M. Oya", Scale ve Runs.
- Tüm sayfalara kolofon eklenir: mehmetoya (GitHub bağlantısı), fontlar, "No trackers · no server · CSP-locked" ve revizyon.
- `check.mjs` kontrol (b) eklenir: `rev` alanı `YYYY.MM.DD` biçiminde olmalı.

**Kabul kriterleri:**
- [x] Pafta numarası, araç registry'deki sırasıyla eşleşiyor (01–28).
- [x] Biçimi bozuk bir `rev` değeri kapıyı kırmızı yakıyor.
- [x] Antet kutusu 375 px'te taşmıyor (hücreler 2 sütuna iniyor).

**Doğrulama:** Standart kapı geçiyor; `scan.mjs` temiz.

**Bağımlılık:** T7 · **Dosyalar:** `assets/tools.js`, `assets/app.css`, `scripts/check.mjs` · **Kapsam:** S–M

## T9: Ana sayfa (pafta dizini) ve 404 sayfası
**Açıklama:** `gen-site.mjs` içindeki ana sayfa şablonu yeniden yazılır:
- üstte büyük bir "Find a tool" düğmesi paleti açar;
- altında kategori bölümleriyle 28 aracın numaralı dizini (numara, ad, açıklama) yer alır;
- eski `.home-search` kaldırılır.

404 sayfası aynı dizini ve kolofonu taşır. Inline style ve script hash'lerini `gen-site.mjs` üretir.

**Kabul kriterleri:**
- [x] Ana sayfada tam olarak bir `h1` var; head sözleşmesi ve CSP hash'leri `check.mjs`'ten geçiyor.
- [x] Dizindeki numaralar sidebar ve antet kutusundaki numaralarla aynı.
- [x] 404 sayfası noindex kalıyor ve meta CSP içeriyor.

**Doğrulama:** Standart kapı geçiyor; `scan.mjs` temiz; ana sayfanın 375 ve 1280 px ekran görüntüleri.

**Bağımlılık:** T8 · **Dosyalar:** `scripts/gen-site.mjs`, `assets/app.css` (`index.html` ve `404.html` üretiliyor) · **Kapsam:** M

### Kontrol noktası C: tamamlanma
- [x] Spec'teki başarı ölçütleri 1–8 tek tek işaretlendi. Ölçüt 9, yani ziyaretçi testi, yayından sonra yapılacak.

---

## T10: Syne'yi kaldır, README'yi ve bütçe ölçümünü güncelle
**Açıklama:**
- Syne woff2 dosyaları ve lisansı silinir; `VERSIONS.txt` güncellenir.
- `check.mjs` kontrol (a) tamamlanır: hiçbir dosyada Syne referansı kalmamalı ve `@font-face` ile tanımlanan her dosya diskte bulunmalı.
- `smoke.mjs` içindeki font yolları güncellenir.
- README'deki ekran ve özellik metinleri güncellenir.
- İlk yüklemedeki font baytları T2 ölçümüyle karşılaştırılır.

**Kabul kriterleri:**
- [x] İlk yüklemede indirilen font baytları T2 ölçümünü aşmıyor (spec ölçütü 4).
- [x] Silinmiş bir font dosyasına referans kalırsa kapı kırmızı yanıyor.

**Doğrulama:** Standart kapı geçiyor; `scan.mjs` temiz.

**Bağımlılık:** T9 · **Dosyalar:** `assets/fonts/*`, `scripts/check.mjs`, `scripts/smoke.mjs`, `README.md` · **Kapsam:** S

## T11: Oda kapıları ve yayın
**Açıklama:**
1. Kapılar sırayla çalıştırılır, her birinin bulguları düzeltilir:
   - `designers-room`: tamamlanmış arayüz;
   - `developers-room` + `security-audit`: kontrol noktası B'den sonraki fark (gen-site şablonları, inline hash'ler, font kaynakları);
   - `qa-room`: başarı ölçütleri 1–8 ve regresyonlar;
   - `ops-room`: yayın hazırlığı.
2. Branch açılır, commit atılır, PR oluşturulur.
3. Deploy preview üzerinde `smoke.mjs` ve `scan.mjs` çalıştırılır.
4. Merge, sahibinin açık onayıyla yapılır.
5. Merge'den sonra production üzerinde `smoke.mjs` çalıştırılır.

**Kabul kriterleri:**
- [ ] Engelleyici (P0/P1) bir oda bulgusu kalmadı.
- [ ] Preview ve production (`https://tool.mehmetoya.com`) smoke testleri yeşil; `/docs/...` 404 dönüyor.
- [ ] `devtool-moya.netlify.app` adresi 301 ile `tool.mehmetoya.com` adresine yönleniyor; DNS kaydı DNS only, sertifika geçerli.
- [ ] Geri dönüş deploy'unun kimliği PR açıklamasına yazıldı.

**Doğrulama:** Oda raporları, smoke çıktıları, PR bağlantısı.

**Bağımlılık:** T10 · **Dosyalar:** Oda bulgularına göre · **Kapsam:** Bilinmiyor (bulgulara bağlı)
