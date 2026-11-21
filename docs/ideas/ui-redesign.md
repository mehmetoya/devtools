# devtool-moya — "Teknik Çizim" arayüzü

Durum: yön seçildi (2026-11-21). Taslak: üç yön karşılaştırıldı (Teknik çizim / Tezgâh / Matbaa); sahibi Teknik çizim'i seçti.

## Problem
Sahibin her gün hızla kullandığı, gören herkesin de "bunu kim yaptı?" diye soracağı bir araç atölyesini nasıl kurarız?

## Niyet (onaylı)
- **Sonuç:** Arayüz baştan tasarlanır; görsel kimlik, ana sayfa, menü ve araç ekranlarının yerleşimi dahil her şey değişebilir. Yön "zanaat atölyesi": koyu, detaycı, elle yapılmış hissi; alışılmış neon-hacker görüntüsünden uzak.
- **Kullanıcı:** Önce sahibi (günlük iş aracı), sonra siteyi görenler (kişisel reklam).
- **Başarı:** Aradığın araca klavyeyle iki adımda ulaşmak; favoriler el altında; fare olmadan kullanım. Siteyi gören biri imzayı buluyor.
- **Kısıt:** Hash tabanlı CSP, üçüncü taraf istek yok, mevcut erişilebilirlik korunur, statik site, `scripts/check.mjs` geçer, URL'ler değişmez.
- **Kapsam dışı:** Araç mantığı, yeni araç, backend/hesap/analytics, framework veya bundler.

## Seçilen yön
Her araç sayfası, 28 paftalık bir setin bir paftası gibi tasarlanır:
- kömür rengi kâğıt üzerinde ölçek ızgarası;
- ince çizgiler ve köşe işaretleri;
- tek vurgu rengi olarak turuncu "kırmızı kalem";
- yerleşim ve etiketlerde IBM Plex Sans Condensed (büyük harf), veride IBM Plex Mono.

İmza süs olarak eklenmez; mimari çizimdeki antet kutusundan doğal olarak çıkar. Kutu araç adını, pafta numarasını (07/28), revizyon tarihini ve "Drawn by" satırını taşır. Her sayfanın altındaki kolofon aynı zanaat dilini sürdürür.

Hız hedefini komut paleti karşılar:
- `/` veya ⌘K ile açılır;
- aracın adı yazılır, Enter ile açılır;
- favoriler en üstte durur ve `g1`–`g4` kısayollarıyla açılır.

## Doğrulanacak varsayımlar
- [ ] **Izgara uzun kullanımda yormaz.** Bir hafta günlük kullanımla denenir. Yorarsa ızgara yalnız kenarlarda ve boş alanlarda kalır.
- [ ] **Bir araca iki adımda ulaşılır.** `/` → yazı → Enter akışı, 28 aracın hepsinde fare olmadan denenir.
- [ ] **İmza fark edilir.** Site 2–3 kişiye gösterilir ve "bunu kim yapmış?" diye sorulur.
- [ ] **Kontrast korunur.** Muted metin #8796a5, #0e1318 üzerinde yaklaşık 6.3:1. Turuncu vurgu da ölçülür ve erişilebilirlik kontrolü yeniden koşulur.

## MVP kapsamı
**Kapsamda:**
- `app.css` için yeni token'lar ve doku;
- `tools.js` içinde komut paleti, favori kısayolları, antet kutusu ve kolofon;
- yeni ana sayfa;
- değişikliklerin tüm sayfalara uygulanması;
- self-hosted fontlar;
- `check.mjs` ve `smoke.mjs` testlerinden geçiş.

**Kapsam dışı:** araç mantığı, URL değişikliği, yeni araç.

## Yapılmayacaklar
- **Açık tema:** Koyu tema kararı veriliyor; açık tema belki ileride seçenek olarak eklenir.
- **Tezgâh tarzı süsler (gradient, mühür):** Bakım yükü getirir ve dikkati dağıtır.
- **Animasyonlu çizim efektleri:** Hız hedefine ters düşer ve reduced-motion ayarıyla sorun çıkarır.
- **Framework'e geçiş:** Statik yapı ve hash tabanlı CSP korunur.

## Açık sorular
- Tezgâh yönünden sıcaklık alınacak mı? Öneri: zemini biraz sıcak bir tona çekmek ve sayfa başlığında serif kullanmak.
- Antet kutusundaki imza "M. Oya" mı olacak, "mehmetoya" mı?
- Ana sayfa bir pafta dizini mi olacak, yoksa ortada büyük bir komut paleti mi duracak?
