# Uygulama planı: "Teknik Çizim" arayüzü

Spec: [docs/specs/ui-redesign.md](../specs/ui-redesign.md) (onaylandı 2026-11-21). Görevler ayrıntılı olarak burada: [docs/tasks/ui-redesign.md](../tasks/ui-redesign.md).

## Genel bakış
Yeniden tasarım ortak kabuk üzerinden yapılır: `assets/app.css` ve `assets/tools.js`. Ana sayfa ve 404 için `scripts/gen-site.mjs` kullanılır. 28 araç sayfasının gövdesi ve hesaplama mantığı değişmez. Bu sayede sayfalardaki inline script hash'leri de sabit kalır.

İş dört aşamada ilerler:
1. Altyapı: gizlilik, araçlar, fontlar.
2. Görsel sistem: token'lar, doku, bileşenler.
3. Kabuk: palet, menü, kısayollar.
4. İmza: antet kutusu, kolofon, ana sayfa.

Ardından temizlik ve oda denetimleri gelir.

## Mimari kararlar
- **Kabuk merkezli değişiklik.** Görünüm tamamen CSS ve `tools.js` tarafından üretilen DOM ile değişir. Sayfa gövdelerine toplu dokunulmaz.
  - Gerekçe: 28 sayfadaki değişiklik riski ve CSP hash'lerinde kayma önlenir.
- **Panel harfleri CSS ile eklenir.** `A — INPUT` gibi harfler `::before` ve `content: "A — " / ""` sözdizimiyle eklenir; harf ekran okuyucuya okunmaz.
  - Gerekçe: Sayfalarda değişiklik gerektirmez ve erişilebilirlik ağacını kirletmez.
- **Palet sıralama fonksiyonu saf ve dışa açık.** Fonksiyon `DevTools.rankTools(query, tools, favs)` olarak dışa açılır. `check.mjs` aynı fonksiyonu `vm` içinde çalıştırır ve her aracın en fazla 4 karakterle bulunabildiğini garanti eder.
  - Gerekçe: Başarı ölçütü 1 build zamanında test edilebilir hale gelir.
- **Revizyon tarihi registry'den gelir.** Her araç kaydında elle girilen bir `rev` alanı olur.
  - Gerekçe: Üreteç çıktısı deterministik kalır; drift kontrolü bozulmaz.
- **Önce palet, sonra sidebar araması kaldırılır.** Araç aramak her ara adımda mümkün kalır.
- **Fontlar `@fontsource` paketlerinden alınır.** Yalnız woff2 dosyaları kopyalanır; sha256 değerleri `assets/fonts/VERSIONS.txt` dosyasına yazılır ve `check.mjs` bunları doğrular. npm bağımlılığı eklenmez.

## Kalite kapıları (oda skilleri)
Her kapı bir kontrol noktasında çalışır. Kapının bulguları düzeltilmeden sonraki aşamaya geçilmez. Sıra mantığı şöyle: tasarım kararı kod üstüne inşa edilmeden önce denetlenir; kod denetimi ve güvenlik denetimi kabuk kodu bittiğinde birlikte yapılır; davranış testi her şey bittikten sonra gelir; yayın hazırlığı en son değerlendirilir.

| Kontrol noktası | Kapı | Odak |
|---|---|---|
| A (T5'ten sonra) | `designers-room` | Görsel sistem: kontrast, ızgara gürültüsü, tipografi, 375 px. Kabuk bu temelin üstüne kurulmadan önce. |
| B (T7'den sonra) | `developers-room` | Palet, kısayollar, favoriler; `tools.js` mimarisi; `serve.mjs` / `scan.mjs`. |
| B (T7'den sonra) | `security-audit` (yönlendirmeli mod, `CLIENT-SIDE.md` odaklı) | Palet ve kabuk DOM sink'leri, `localStorage`, klavye olayları, CSP değişmezleri. `serve.mjs`'te path traversal. |
| T11 (yayından önce) | `designers-room` | Tamamlanmış arayüz: ana sayfa, 404, antet kutusu, kolofon, mobil. |
| T11 | `developers-room` + `security-audit` | B'den sonraki fark (T8–T10): `gen-site.mjs` şablonları, yeni inline hash'ler, font kaynakları (supply chain). |
| T11 | `qa-room` | Spec'teki başarı ölçütleri 1–8 ve A-01…A-09 regresyonları; gerçek tarayıcıda. |
| T11 | `ops-room` | Preview smoke testi, `/docs` 404, cache ve font header'ları, geri dönüş. |

## Görev listesi
### Aşama 0: Altyapı
- [x] T1: `docs/` yolunu yayından gizle
- [x] T2: `serve.mjs` ve `scan.mjs`'i repoya al, bugünkü durumun ölçümünü al
- [x] T3: Yeni fontları self-host et

- [x] TD: Alan adı `tool.mehmetoya.com` (repo tarafı)

### Kontrol noktası 0
- [x] `check.mjs` yeşil; `scan.mjs` bugünkü sitede temiz; ölçüm sonuçları plana yazıldı

### Aşama 1: Görsel sistem (yüksek risk, en başta)
- [x] T4: Token'lar, ızgara, tipografi ve kontrast kontrolü
- [x] T5: Bileşenler: panel, seçenek satırı, düğme, mesaj, about; tercih sorguları

### Kontrol noktası A: görsel sistem
- [x] `scan.mjs` 375 ve 1280 px'te temiz; kontrast kontrolü yeşil
- [x] `designers-room` görsel sistem denetimi; bulgular düzeltildi (22 bulgu: 19 düzeltildi, 1 kısmen, 2 bilinçli bırakıldı / ertelendi)
- [ ] Sahibiyle 4 sayfa üzerinden görsel inceleme: base64, json-formatter, compare, markdown-viewer

### Aşama 2: Kabuk
- [x] T6: Komut paleti
- [x] T7: Header, sidebar, favori kısayolları ve kısayol anahtarı

### Kontrol noktası B: klavye
- [x] Fare kullanmadan tur: palet, `g` kısayolları, skip link, mobil çekmece
- [ ] QA Odası'nın A-01…A-09 düzeltmelerinde gerileme yok
- [x] `developers-room` ve `security-audit` (kabuk kodu) tamamlandı; bulgular düzeltildi

### Aşama 3: İmza
- [x] T8: Antet kutusu ve kolofon
- [x] T9: Ana sayfa (pafta dizini) ve 404 sayfası

### Kontrol noktası C: tamamlanma
- [ ] Spec'teki başarı ölçütleri 1–8 sağlandı

### Aşama 4: Temizlik ve yayın
- [x] T10: Syne'yi kaldır, README'yi ve bütçe ölçümünü güncelle
- [x] T11: Oda kapıları (Designers → Developers + Security → QA → Ops), PR, preview smoke testi, merge onayı

## Paralellik
- T3, T1 ve T2 ile paralel yürüyebilir; dosyaları ayrı.
- T4'ten sonraki her şey sıralı yürür, çünkü hepsi `app.css` ve `tools.js` dosyalarını paylaşıyor.

## Alan adı (TD, 2026-11-21)
- Hedef adres `https://tool.mehmetoya.com`. `mehmetoya.com`'un DNS'i Cloudflare'de. Ana site (`mehmetoya/eleventy`) bir Cloudflare Worker ve `tool` alt alan adını kullanmıyor.
- **Repo tarafı (yapıldı):** `SITE_URL` artık tek yerde, `scripts/site.mjs` içinde; gen-site ve check oradan okuyor. Eski adres (`PREVIOUS_ORIGINS`) sayfa başlıklarında yeni adrese çevriliyor. Canonical, `og:url`, JSON-LD, sitemap ve robots yeni adresi kullanıyor. README ve smoke metni güncellendi.
- **Sahibin yapacakları, merge'den ÖNCE:**
  1. Netlify'da devtool-moya için özel alan adı olarak `tool.mehmetoya.com` eklenir ve primary yapılır.
  2. Cloudflare DNS'te `CNAME tool → devtool-moya.netlify.app` kaydı açılır, **DNS only** (gri bulut).
  3. Netlify sertifikası aktif olmalı.
- **Doğrulama (T11, Ops):** `node scripts/smoke.mjs https://tool.mehmetoya.com` yeşil olmalı. `curl -sI https://devtool-moya.netlify.app/base64` → `301` ve `location: https://tool.mehmetoya.com/base64`.

## Başlangıç ölçümü (T2, 2026-11-21)
- `node scripts/scan.mjs`: 30 sayfa × 375/1280 px; sıfır CSP ihlali, hata, üçüncü taraf istek veya taşma.
- Ana sayfanın ilk yüklemesi: **5 font dosyası, 72.763 bayt** (encoded). Spec'teki başarı ölçütü 4 bu değere göre ölçülür.
- Tarama betiği puppeteer yerine doğrudan Chrome DevTools Protocol kullanıyor; npm bağımlılığı ve npx gerekmiyor.

## T4 notları (2026-11-21)
- Ana sayfa ilk yükleme: 4 font dosyası, 74.156 bayt. Başlangıç değeri olan 72.763'ün 1.393 bayt üstünde. T9'da ana sayfa yenilendikten sonra, T10'da yeniden ölçülecek. Aşım sürerse Condensed 500 ağırlığı kaldırılabilir; o durumda yalnız 600 kullanılır.
- T5: Paneller sayfa sırasıyla harflendiriliyor (A, B, C…). JWT gibi çok panelli sayfalarda bu harfler L'ye kadar gidiyor, teknik çizimdeki görünüş harfleri gibi. `msg()` artık metnin başındaki ✓/✗/⚠ işaretini atıyor, çünkü işareti CSS çiziyor; sayfa script'lerine dokunulmadı.
- Başarı anlamı taşıyan renkler (geçerli, eklendi, güçlü, 2xx) turuncu vurgudan yeni `--ok` token'ına taşındı. Bu değişiklik 7 sayfanın `<style>` bloklarına ve password-generator'daki bir inline script'e dokundu; inline script'in hash'i gen-site tarafından yeniden üretildi.

## T6 notları (2026-11-21)
- Palet `DevTools.openPalette()`, sıralama `DevTools.rankTools()` (saf). Her araca takma adlar eklendi (`aliases`).
- Sıralama: önce güçlü eşleşme (ad, takma ad, route öneki), sonra zayıf eşleşme. Her grubun içinde önce favoriler, sonra skor, sonra registry sırası.
- `check.mjs` (c): her araç en fazla 4 karakterlik bir sorguyla ilk sırada bulunabiliyor. Bir takma ad silindiğinde kapı kırmızı yandı.
- `scan.mjs`: her sayfada "/" paleti açıyor, odak arama alanında; Esc paleti kapatıyor ve odak açan öğeye dönüyor. Esc'nin kapatmadığı bozuk bir kopyada 29 sayfa kırmızı yandı.
- Not: Native `<dialog>` odağı kendisi de geri veriyor. Bu yüzden kendi geri verme kodumuzu silen bozma testi yakalayamaz; testi Esc üzerinden kanıtladık.
- Tek tuş kısayolu `/` artık `devtools:shortcuts` ayarına bağlı; ayarın arayüzü T7'de gelecek.

## Kontrol noktası B ve T8–T10 notları (2026-11-21)
- **Güvenlik:**
  - SEC-01: Netlify dosya yollarını büyük/küçük harfe duyarsız eşliyor; `/Scripts/…` ve `/Readme.md` 200 dönüyordu. Artık yalnız `dist/` yayınlanıyor; `scripts/build-dist.mjs` izin listesiyle kopyalıyor. `check.mjs` yayın klasörünü, build komutunu ve izin listesini denetliyor; smoke testi büyük/küçük harf varyantlarını da deniyor.
  - SEC-02: `serve.mjs` artık Host başlığını denetliyor (DNS rebinding), nokta ile başlayan yolları ve büyük/küçük harf varyantlarını gizliyor, dosya okuma hatasında çökmüyor. Sekiz yol 404, yabancı Host 403 döndü.
  - Netlify'da ilk eşleşen kural kazandığı için eski origin'den 301 kuralı artık path rewrite'larından önce; `check.mjs` bu sırayı denetliyor.
  - `readFavs()` yalnız string kabul ediyor, en çok 64 öğe.
- **Developers:**
  - B-01: Ekran genişleyince açık çekmece kapanıyor.
  - B-02: `scan.mjs`'e palet senaryosu eklendi (↓ → Enter → doğru sayfa; sonuç yokken Enter yerinde kalıyor). Çekmece senaryosu da eklendi; bozuk kopyada kırmızı yandı.
  - B-03: Backdrop'ta yalnız gerçek tıklama paleti kapatıyor; tuşlar diyaloğun her yerinde çalışıyor.
  - B-04: IME ile yazarken basılan Enter yok sayılıyor.
  - B-05: `msg()` artık `!important` gibi metinleri yutmuyor.
  - B-06: Favoriler yazılmadan önce taze okunuyor, böylece başka sekmenin değişikliği ezilmiyor.
  - B-08: Eski origin yalnız `<head>` içinde yeniden yazılıyor ve `check.mjs` sayfalarda eski origin'i arıyor.
  - B-09: CDP çağrılarına zaman aşımı eklendi; geçici profil her durumda temizleniyor.
  - B-10: `norm()` için birim kontrolleri eklendi.
  - `aria-expanded`, sonuç yoksa `false`.
  - B-07 (Ctrl+K textarea içinde de paleti açıyor) spec gereği bırakıldı.
- **T8:** Antet kutusu ve kolofon eklendi; `rev` biçimi `check.mjs` ile denetleniyor.
- **T9:** Ana sayfa ve 404 numaralı pafta dizini oldu; ana sayfadaki büyük "Find a tool" düğmesi paleti açıyor.
- **T10:** Syne ve kullanılmayan Condensed 500 kaldırıldı. Ana sayfanın ilk yüklemesi **3 font, 58.729 bayt** (başlangıçta 72.763 bayt). Skip link ve yıldız düğmesi artık yüklenmemiş ağırlık ya da Arial istemiyor.

## T11 oda kapıları (2026-11-21)
- **Designers:** Engelleyici bulgu yok, D2-01…08 düzeltildi.
  - İmza ana sayfanın ilk ekranına taşındı.
  - Kısayol ipuçları ayara göre görünüyor.
  - Palete kapatma düğmesi eklendi.
  - Sayfada tek `aria-current` kalıyor.
- **Developers + güvenlik:** Yeni açık yok, T11-DEV-01…05 düzeltildi.
  - `serve.mjs` artık `dist/`'i de sunabiliyor.
  - `build-dist` ürettiği çıktıyı kendisi doğruluyor.
  - Yayın kapıları sıkılaştırıldı.
- **QA:** Sonuç "koşullu uygun"du, koşullar kapandı.
  - QA-01: mobil menü düğmesi yeniden 44 px; `scan` 320 px'te bu boyutu ölçüyor ve bozuk kopyada kırmızı yandı.
  - QA-02: palette ✕'e Enter basınca palet kapanıyor.
  - QA-03 ve QA-05 de düzeltildi.
- **Ops:** Sonuç "koşullu hazır".
  - OPS-01 (preview taramasında Netlify drawer'ının yarattığı gürültü) kapandı: `scan` bunu yalnız deploy preview host'unda yok sayıyor. Preview'da 30 × 3 genişlik temiz.
  - OPS-02: 301 yönlendirmesi merge'den sonra doğrulanacak.
  - Geri dönüş: Netlify'da `6b01366b3511466fd70aea87` yeniden yayınlanır, ardından main'de `git revert` yapılır.

## Yayın (2026-11-21)
- PR mehmetoya/devtools#2 merge edildi (d682fe4).
- Production kontrolleri:
  - `smoke.mjs https://tool.mehmetoya.com` yeşil.
  - `scan.mjs` 30 sayfa × 320/375/1280 px temiz.
  - `devtool-moya.netlify.app/*` → 301 → `tool.mehmetoya.com`.
  - Repo yolları (büyük/küçük harf varyantları dahil) 404.
  - Fontlar immutable.
  - Canonical, robots ve sitemap yeni alan adında.
- Açık kalan: Ölçüt 9 (ziyaretçi testi) ve VoiceOver turu; bunları sahibi yapacak.

## Riskler ve önlemler
| Risk | Etki | Önlem |
|---|---|---|
| Izgara uzun kullanımda yorar veya metin okunurluğunu düşürür | Orta | Panel ve alan zeminleri opak olur. Kontrol noktası A'da sahibi bakar. Gerekirse ızgara yalnız kenar ve boşluk alanlarında kalır. |
| Palet erişilebilirliği (combobox, odak dönüşü, duyurular) | Yüksek | Native `<dialog>` ve APG combobox deseni kullanılır. Kontrol noktası B'de VoiceOver turu yapılır. `scan.mjs` aç-kapa-odak testini içerir. |
| Tek tuşlu kısayollar yazmayı engeller veya WCAG 2.1.4'ü ihlal eder | Orta | Kısayollar odak bir alandayken devre dışıdır. Kapatma anahtarı bulunur ve ⌘K her zaman çalışır. |
| Font bütçesi aşılır (3 aile) | Düşük | Yalnız gereken ağırlıklar alınır. latin-ext dosyaları `unicode-range` ile gerektiğinde yüklenir. T2 ölçümü ile T10 ölçümü karşılaştırılır. |
| Ana sayfadaki inline style veya script değişince CSP hash'i değişir | Düşük | `gen-site.mjs` hash'i yeniden üretir. `check.mjs` hem hash eşleşmesini hem drift'i kontrol eder. |
| Mevcut `/` davranışına alışkanlık (sidebar araması) | Düşük | Palet aynı tuşla açılır ve sidebar aramasından daha fazlasını yapar. |
| DNS ve sertifika hazır olmadan merge edilirse canonical ve sitemap çalışmayan bir adresi gösterir | Orta | Merge'den önce TD'deki 3 adım tamamlanır; Ops kapısı adresi ve 301 yönlendirmesini doğrular. |
| Netlify `docs/` yolunu yayınlar | Orta | T1 en başta yapılır. Docs dosyaları T1 commit'lenmeden repoya girmez. |

## Açık sorular
- Revizyon tarihi başlangıçta `2026.11.21` olarak varsayıldı (spec'teki açık soru 1).
