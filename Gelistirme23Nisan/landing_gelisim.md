# Landing Page Geliştirme Görev Listesi

**Tarih:** 2026-05-02
**Audit Skoru:** 3.76 / 5 (Good)
**Hedef:** 4.5+ (Excellent)
**Sayfa:** `src/app/(marketing)/page.tsx` (1100 satır) + `src/app/(marketing)/landing.css` (2300 satır)
**Sayfa tipi:** B2B SaaS — kurumsal L&D / yönetici geliştirme
**Birincil dönüşüm:** `#demo` formu (Demo Talep Et)

---

## Hızlı Bağlam

Landing page production öncesi son ince ayar aşamasında. Audit sonucu güçlü içerik mimarisi var (problem → nasıl → ICF → rapor → fayda → güvenlik → demo → SSS) ama 5 önemli açık var:

1. Hero headline metaforik, outcome iletmiyor
2. Sosyal kanıt sıfır (logo/testimonial/sayı yok)
3. Tek CTA (yüksek friction demo formu) — düşük friction alternatif yok
4. Mid-page CTA tekrarı yok (yalnızca header + hero + #demo)
5. Mobile render audit edilmemiş

Aşağıdaki görevler **tamamı önümüzdeki 1 hafta** içinde bitirilebilir kapsamda. Her görevin sonunda kabul kriteri var.

---

## Genel Notlar

- **Çalışma branch'i:** `feat/landing-conversion-pass-1` — her görev ayrı commit
- **Test:** Her görev bittikten sonra `localhost:3001` üzerinde Chrome (desktop) + DevTools mobile emulation (375px iPhone SE) ile görsel kontrol
- **Lighthouse:** Tüm değişiklikler bittikten sonra production deploy öncesi `npx lighthouse http://localhost:3001 --view` çalıştır, performance + accessibility skorlarını rapora ekle
- **Prod sonrası:** `pagespeed.web.dev` ile gerçek production URL ölçümü
- **Stil prensibi:** Mevcut `landing.css` design system'ini kullan (`--surface-low`, `btn`, `btn-primary`, `btn-ghost`, `section-pad`, `dark-section`). Yeni custom CSS yazmadan önce bu sistemde hazır class arar mısın.

---

## P0 — BU HAFTA (Yüksek Etki, Düşük Efor)

### TASK-1: Hero Headline'ı Outcome-Led Yap

**Sorun:** Mevcut headline metaforik ("Sahneyi biz kuruyoruz") — ziyaretçi 3 saniyede ne satıldığını anlayamıyor. Subheadline gerektirmesi headline'ın zayıflığına işaret.

**Yapılacak:**
`src/app/(marketing)/page.tsx:391-394` — H1 değişimi:

```tsx
<h1 className="hero-headline">
  Yöneticileriniz <em>zor konuşmaları</em><br />
  önce burada prova etsin.<br />
  Sahaya hazır çıksın.
</h1>
```

Subheadline kalsın (`page.tsx:396-401`) — şimdiki haliyle iyi destekliyor.

**Kabul Kriteri:**
- Desktop'ta H1 4 satırda yer almıyor (1100px viewport)
- Mobile'da H1 (375px) okunabilir, taşma yok
- `<em>` italic styling korunuyor (`landing.css:330`)
- Subheadline H1 ile birlikte hâlâ uyumlu okunuyor

**Tahmini efor:** 15 dk

---

### TASK-2: Hero'ya 2. CTA Ekle (Düşük Friction)

**Sorun:** Sadece "Demo Talep Et" var (yüksek friction form). Henüz hazır olmayan ziyaretçiyi kaybediyoruz.

**Yapılacak:**
`page.tsx:403-406` mevcut CTA bloğunu değiştir:

```tsx
<div className="hero-cta">
  <a href="#demo" className="btn btn-primary btn-lg">Demo Talep Et</a>
  <a href="#report" className="btn btn-ghost btn-lg">Örnek Raporu Gör</a>
</div>
```

İkinci buton kullanıcıyı `#report` section'ına smooth-scroll yapar — orada zaten örnek rapor mockup var (`page.tsx:692`). Yeni içerik üretmeye gerek yok.

**Eski "Kurumunuza Özel Senaryo" butonu (mevcut secondary):** Bu daha düşük öncelikli. `#contact` anchor da yok zaten, bu link kırık. Kaldır, "Örnek Raporu Gör" ile değiştir.

**Kabul Kriteri:**
- 2 CTA yan yana, mobile'da alt alta dizilir (`landing.css:343` `.hero-cta` flex davranışı kontrol)
- "Örnek Raporu Gör" tıklanınca `#report` section'ına smooth scroll
- Buton kontrastları erişilebilir (WCAG AA — `btn-ghost` outline kontrast oranı 3:1+)

**Tahmini efor:** 10 dk

---

### TASK-3: Hero Altına "Trust Anchor" Şeridi Ekle

**Sorun:** Sosyal kanıt sıfır. Pre-launch olduğu için müşteri logosu yok — ama "honest scarcity" devreye sokulabilir.

**Yapılacak:**
`page.tsx`'de `<section id="hero">` kapanışından (`page.tsx:518` civarı, `</section>` sonrası) hemen önce yeni bir block ekle. `#hero` section'ının içinde, `.hero-trust` div'inden sonra:

```tsx
<div className="hero-anchor-strip">
  <span className="hero-anchor-pulse" aria-hidden />
  <span className="hero-anchor-text">
    Erken erişim — pilot kurum kontenjanı sınırlı.
    İlk 5 kuruma %30 pilot indirimi.
  </span>
</div>
```

**CSS** (`landing.css` sonuna ekle, ~line 2200 öncesi):

```css
.hero-anchor-strip {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 1.5rem;
  padding: 0.5rem 0.875rem;
  background: rgba(168, 85, 247, 0.08);
  border: 1px solid rgba(168, 85, 247, 0.25);
  border-radius: 999px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}
.hero-anchor-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a855f7;
  box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.6);
  animation: hero-anchor-pulse 2s infinite;
}
@keyframes hero-anchor-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.6); }
  70%  { box-shadow: 0 0 0 10px rgba(168, 85, 247, 0); }
  100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
}
```

> **Not (ürün ekibine):** İlk pilot anlaşma imzalandığında metni "X kurum, Y yönetici aktif kullanıyor" formatına döndür.

**Kabul Kriteri:**
- Hero CTA'larının 1.5rem altında, sol hizalı
- Mobile'da satır taşması yok, pulse animasyonu çalışıyor
- `prefers-reduced-motion: reduce` aktifken animasyon duruyor (CSS'e eklemeyi unutma)

**Tahmini efor:** 25 dk

---

### TASK-4: Mid-Page CTA Tekrarları

**Sorun:** Sayfa 11 section uzun. Kullanıcı `#how`, `#personas`, `#report`, `#security`'yi okuduktan sonra dönüşüm fırsatı yok — `#demo`'ya kadar scroll etmesi gerekiyor.

**Yapılacak:**
3 stratejik noktaya tek satırlık inline CTA ekle:

1. **`#personas` section sonuna** (`page.tsx:649` öncesi, `</section>` öncesi)
2. **`#report` section sonuna** (`page.tsx:792` öncesi, `</section>` öncesi)
3. **`#security` section sonuna** (`page.tsx:909` öncesi, `</section>` öncesi)

Her birine standart şablon:

```tsx
<div className="section-cta">
  <a href="#demo" className="btn btn-primary">Demo Talep Et</a>
  <span className="section-cta-hint">30 dakika · sıfır taahhüt</span>
</div>
```

**CSS** (`landing.css` sonuna):

```css
.section-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 3rem;
  flex-wrap: wrap;
}
.section-cta-hint {
  font-size: 0.875rem;
  color: var(--text-muted, rgba(255, 255, 255, 0.6));
}
.dark-section .section-cta-hint { color: rgba(255, 255, 255, 0.6); }
```

**Kabul Kriteri:**
- 3 mid-page CTA görünür, her biri `#demo`'ya scroll
- Buton stili tüm site CTAs ile tutarlı
- `dark-section` (personas + report + gamification) içinde renkler doğru

**Tahmini efor:** 20 dk

---

### TASK-5: Mobile Responsive Audit

**Sorun:** Audit yalnızca desktop'ta yapıldı. Mobile render test edilmedi.

**Yapılacak:**
Chrome DevTools'da 3 viewport'ta hero + her section sırayla test et:

| Cihaz | Genişlik | Test Edilecek |
|---|---|---|
| iPhone SE | 375px | Hero okunabilirlik, atom-stage taşması, CTA fold içinde mi |
| iPhone 14 Pro | 393px | Aynı + safe area |
| iPad Mini | 768px | Section padding, persona grid 2/3 sütun davranışı |

**Bulguları rapor et:**
Bu dosyaya `## TASK-5 Mobile Audit Bulguları` başlığı altında bullet liste ekle. Her bulgu için:
- Cihaz + viewport
- Hangi section
- Sorun (taşma / okunmaz / overlap / kırık layout)
- Tahmini fix efforu

**Bilinen şüpheli noktalar (önceden kontrol et):**
- `#hero` `.atom-stage` (3D atom orbit) mobile'da yer alıyor mu? `landing.css:2198, 2213` mobile breakpoint'leri var ama atom-stage özel davranışı kontrol edilmeli.
- `#personas` 5 kart grid — mobile'da yatay scroll mu, alt alta mı?
- `#report` mockup içindeki rakamlar (`28/40`, `7/10` vb.) mobile'da bozulmuyor mu?
- Sticky nav 7 menü item'ı 375px'te taşıyor mu?

**Kabul Kriteri:**
- 3 viewport'ta her section taşmasız render
- Hero CTA fold içinde (scroll gerekmez)
- Bulgular bu dosyaya eklendi
- Kritik sorun varsa TASK-6 olarak ayrı issue açılır

**Tahmini efor:** 45 dk (test) + bulgu sayısına göre fix

---

## P1 — BU AY (Stratejik İyileştirme)

### TASK-6: Sosyal Kanıt Bloğu (İlk Pilot Sonrası)

**Bağımlılık:** İlk pilot tenant ile case study anlaşması imzalanmalı.

**Yapılacak:**
`#report` ile `#corporate-benefits` arasına yeni `<section id="proof">` ekle. İçerik:

- 1-3 anonim testimonial (rol + sektör + 1-2 cümle alıntı)
- 1 anonim case study mini-card (örn. "İlaç sektörü, 12 yönetici, 8 hafta — Pillar B'de ortalama +1.4 puan artış")
- (Varsa) müşteri logo strip — yoksa "Erken erişim ortakları" başlıklı sektör isimleri ("İlaç · Bankacılık · Telekom")

**Stil:** Mevcut `section-pad` + light bg (dark-section değil). Testimonial kartları `box-shadow` ile hafif yükseltilmiş.

**Kabul Kriteri:**
- Section navbar'a "Kanıt" item olarak eklenir (`page.tsx:354` civarı nav listesi)
- Mobile'da kartlar tek sütun, desktop'ta 3 sütun
- Anonim alıntılar tarafından sağlanan KVKK onayları (ürün ekibi)

**Tahmini efor:** 2-3 saat

---

### TASK-7: Persona Section'ı 12'ye Tamamla (Veya İddiayı Düşür)

**Sorun:** Audit'te tespit edildi — site "12+ persona" diyor (`page.tsx:649` linki) ama 5 gösteriyor. Tutarsız.

**Seçenek A:** 12 persona görselini production'a hazırla, carousel/grid'i 12 karta çıkar.

**Seçenek B (kısa vadede önerilen):** Metni dürüstleştir:

`page.tsx:608` civarı (PERSONA GALERİSİ section header'ı altındaki açıklama):

```tsx
"5 hazır persona kütüphanemizle başla. Kurum talebine göre
12+ özelleştirilmiş persona hazırlanır."
```

`page.tsx:649` (link metni):
```tsx
"→ Kurumunuza özel persona oluşturma sürecini öğrenin"
```
Bu link `#demo`'ya gidebilir (CTA tekrarı bonus).

**Kabul Kriteri:**
- "12+" iddiası ya gerçekleşir (Seçenek A) ya kaldırılır (Seçenek B)
- Tutarsızlık yok

**Tahmini efor:** Seçenek A: 4-6 saat (görsel + content). Seçenek B: 15 dk.

---

### TASK-8: Jargon Tooltip / Inline Açıklama

**Sorun:** "ICF rubric", "pillar", "DP" gibi terimler L&D direktörü için tanıdık ama CFO/CEO/genel ziyaretçi için bariyer.

**Yapılacak:**
Şüpheli terimlerin **ilk geçtiği yerlere** native HTML `<abbr>` veya custom `<Tooltip>` ekle:

| Terim | İlk geçtiği yer | Açıklama |
|---|---|---|
| ICF | `page.tsx:388` (eyebrow) | "International Coach Federation — uluslararası koçluk meslek standartları kuruluşu" |
| Pillar | `page.tsx` `#report` section | "ICF rubric'inin ana boyutu — A, B, C, D olarak gruplanmış 8 yetkinlik" |
| DP | `#gamification` section | "Deneyim Puanı — seans tamamladıkça kazanılan motivasyon puanı" |
| Rubric | İlk geçtiği yer | "Detaylı puanlama cetveli — her boyut için 1-5 arası kriterler" |

**Implementation:** Light tooltip için Radix `<HoverCard>` zaten projede var (shadcn). Yeni bir `<MarketingTooltip>` wrapper component yaz: `src/app/(marketing)/_components/MarketingTooltip.tsx`.

**Kabul Kriteri:**
- 4 terim için tooltip aktif
- Hover ve focus (klavye) ile açılıyor
- Mobile'da tap ile açılıyor (Radix default davranış)
- Dotted underline veya benzer visual cue

**Tahmini efor:** 1.5-2 saat

---

### TASK-9: Hero Görseline Rapor Mockup Ekle

**Sorun:** Mevcut atom-stage konsepti güzel ama "outcome in context" göstermiyor. Ziyaretçi "ne alacağım" sorusunu görselden cevaplayamıyor.

**Yapılacak (öneri):**
Hero sağ tarafına atom-stage'in **alt katmanına** veya **yanına** küçük bir rapor screenshot mockup'ı ekle. Örnek:

- Atom-stage merkez kalır
- Sağ-üst veya sağ-alt köşede 280x180px rapor card görünür (örn. "Pillar B 4.2/5", trend grafiği snippet)
- Subtle drop shadow + slight rotation (-3deg) cinematic feel

**Alternatif:** Atom-stage'i tamamen değiştirmek yerine, atom dönmesine devam ederken arkasına/önüne rapor card overlay ekle.

> **Karar gerekli (ürün ekibi):** Mevcut atom-stage'in marka değeri yüksek. Tamamen değiştirmek mi, yanına eklemek mi? Bu task tasarımcı input'u gerektirebilir.

**Kabul Kriteri:**
- Hero görseli ürün outcome'unu (rapor) en az 1 element ile gösteriyor
- Mevcut atom-stage estetiği bozulmuyor
- Mobile'da gizleniyor veya daraltılıyor (zaten karmaşık)

**Tahmini efor:** 4-6 saat (tasarım + implementation)

---

### TASK-10: Pricing Modeli Anchor

**Sorun:** Fiyat HİÇ gösterilmiyor. B2B'de sayı vermemek norm — ama model şeffaflığı (yıllık/aylık? kurum bazlı/kullanıcı başına?) en azından SSS'e eklenmeli.

**Yapılacak:**
`#faq` section'a yeni soru ekle (`page.tsx:1009` sonrası):

```
Soru: Fiyatlandırma nasıl?

Cevap:
Yıllık abonelik modelinde, kurum büyüklüğüne göre paketlenmiş.
Pilot dönem için 15 günlük ücretsiz erişim mevcuttur.
Kurumsal teklif için demo talep formu üzerinden iletişime geçin —
24 saat içinde size özel teklif iletilir.
```

**Kabul Kriteri:**
- SSS'de fiyatlandırma sorusu var
- Net bir model anchor'ı sağlanıyor (yıllık + kurum bazlı + pilot)
- Tam fiyat verilmiyor (yine intentionally gated)

**Tahmini efor:** 15 dk

---

### TASK-11: Production Performance Audit

**Bağımlılık:** Production deploy yapılmış olmalı.

**Yapılacak:**
Production URL'de (mirror.aionmore.com canlı olduğunda):

1. `pagespeed.web.dev` → Mobile + Desktop skorları
2. Lighthouse CI: Performance, Accessibility, Best Practices, SEO 4 skor
3. Core Web Vitals: LCP, FID, CLS

**Hedef skorlar:**
- Performance (mobile): 85+
- Performance (desktop): 95+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

**Olası bottleneck'ler:**
- Atom-stage SVG/CSS animation (CPU)
- `vendor-d3-*.js` bundle boyutu (`aionmore.com`'da gördük — D3 var)
- Persona görselleri (.webp olduğunu atom-stage'de gördük — iyi, ama lazy-load var mı?)
- Google Fonts preconnect var (iyi) ama font-display: swap kontrol et

**Kabul Kriteri:**
- 4 Lighthouse skoru kaydedildi
- Hedef altı kalan skorlar için iyileştirme listesi çıkarıldı
- Bu dosyaya `## TASK-11 Sonuçları` başlığı altında eklendi

**Tahmini efor:** 1 saat audit + bulgu sayısına göre fix

---

## Tamamlanma Sırası ve Akış

**Pazartesi (1-2 saat):** TASK-1, TASK-2, TASK-4 (hızlı kazanımlar)
**Salı (2 saat):** TASK-3 (trust anchor) + TASK-5 (mobile audit)
**Çarşamba (1 saat):** TASK-5 mobile fixes (audit bulgularına göre)
**Bu hafta sonu:** P0 grup tamamlanmış olmalı, PR review

**Sonraki sprint (1-2 hafta):**
TASK-7 (Seçenek B önerilen) → TASK-10 → TASK-8 → TASK-6 (pilot anlaşma sonrası) → TASK-9 → TASK-11

---

## Bağımlılıklar ve Riskler

| Risk | Etki | Mitigasyon |
|---|---|---|
| `#contact` anchor kırık (`page.tsx:405`) | Düşük (TASK-2 zaten kaldırıyor) | TASK-2 ile çözülüyor |
| TASK-6 pilot anlaşmaya bağımlı | Yüksek (en büyük conversion bloker'ı) | Ürün ekibi pilot pipeline'ını hızlandırmalı |
| TASK-9 (hero görseli) tasarımcı gerekebilir | Orta | Stub olarak placeholder rapor mockup ile başla |
| Mobile audit (TASK-5) önceden bilinmeyen sorunlar açabilir | Orta | Süreyi geniş tut, P0 olarak tedavi et |

---

## Audit Skor Hedefi

| Section | Mevcut | TASK'lar Sonrası Hedef |
|---|---|---|
| Above the Fold | 3.8 | 4.5 (TASK-1, 2, 3) |
| Value Proposition | 4.75 | 4.75 (zaten güçlü) |
| Social Proof | 1.3 | 4.0 (TASK-3 + TASK-6) |
| Clarity & Copy | 4.0 | 4.5 (TASK-7, 8) |
| CTA & Conversion | 3.7 | 4.5 (TASK-2, 4) |
| Trust & Risk | 3.3 | 4.0 (TASK-10) |
| **AĞIRLIKLI TOPLAM** | **3.76** | **4.45+** (Excellent eşiği) |

---

## Kontrol Listesi (PR'a Eklenecek)

- [ ] TASK-1: Hero headline outcome-led
- [ ] TASK-2: 2. CTA "Örnek Raporu Gör"
- [ ] TASK-3: Trust anchor şeridi + pulse animation
- [ ] TASK-4: 3 mid-page CTA tekrarı
- [ ] TASK-5: Mobile audit yapıldı, bulgular dökümante edildi
- [ ] Mobile audit bulgularındaki kritik fix'ler uygulandı
- [ ] Lighthouse desktop skoru: ___ / 100
- [ ] Lighthouse mobile skoru: ___ / 100
- [ ] WCAG AA kontrast kontrolü (yeni eklenen elementler)
- [ ] `prefers-reduced-motion` desteği (yeni animasyon)
- [ ] Smoke test: Tüm 3 CTA `#demo` formuna gidiyor
- [ ] Smoke test: Form submit hâlâ çalışıyor (regresyon yok)

---

**İlgili dosyalar:**
- `src/app/(marketing)/page.tsx` — landing markup (1100 satır)
- `src/app/(marketing)/landing.css` — landing styles (2300 satır)
- `src/app/(marketing)/layout.tsx` — `.landing-root` wrapper (CSS leak fix için kritik, dokunma)

**İletişim:** Audit hakkında soru için bu PR'a yorum bırak veya tasarım önceliği sorularında ürün ekibine yönlendir.

---

## TASK-5 Mobile Audit Bulguları

**Tarih:** 2026-05-02
**Audit ortamı:** localhost:3001 üzerinden Claude Preview (Chrome). 3 viewport: 375x812 (iPhone SE), 393x852 (iPhone 14 Pro), 768x1024 (iPad Mini).
**Kontrol metriği:** `document.documentElement.scrollWidth > clientWidth` (gerçek yatay scroll var mı).

### Genel Sonuç: Kritik sorun yok

Üç viewport'ta da `body` ve `html` scrollWidth = clientWidth (yatay scroll yok). Sayfa CTA'ları fold içinde, hero anchor strip + pulse animation üç viewport'ta da render ediyor, mid-page CTA'lar (TASK-4) merkezlenmiş ve flex-wrap doğru.

### Bulgular (kritik olmayan, info/P1+)

- **375px hero:** `.hero-glow.hero-glow-1` blob elementi viewport dışına taşıyor (left=-94, right=506). **Etki yok** — `body` overflow-x: hidden veya parent containment sayesinde gerçek scroll oluşmuyor; sadece dekoratif glow taşması. Aksiyon gerekmez. — fix efforu **S** (gerekirse parent'a `overflow:hidden` ek), şimdilik **noop**.
- **375px personas-grid:** Kartlar `repeat(2, 1fr)` ile 145.5px'e sıkışıyor. Avatar + isim + 1 satır açıklama okunabilir ama tight. Pre-existing layout, P0 scope dışı. Mobile UX iyileştirme için P1+ olarak değerlendirilebilir (1 sütun + max-width:340 daha rahat olabilir). — fix efforu **S**, **post-P0**.
- **375px rubrics-grid:** Aynı şekilde `repeat(2, 1fr)` — 8 ICF rubric kartı 2x4 dizilimi. Kartlar daha az text yoğun olduğu için 145px'te kabul edilebilir. — **noop**.
- **393px hero:** Tüm elementler temiz. H1 5 satıra çıkıyor (italik wrap nedeniyle), CTA fold içinde. Bulgu yok.
- **768px (tablet):** Hero atom-stage (right column) gizleniyor (`.hero-visual { display: none }` @ 768px). Solo hero-left full width + büyük yazı. personas-grid 2-col, rubrics-grid 2-col, demo-inner 1-col. Hepsi temiz.
- **Section CTAs (TASK-4):** Üç viewport'ta da flex justify-center, button + hint tek satır veya alt satır wrap. 375px'te buton üstte, hint altta (flex-wrap çalışıyor). Beklendiği gibi.
- **Hero anchor strip (TASK-3):** Üç viewport'ta da pulse dot animasyonlu, satır taşması yok. Border-radius 999px doğru render.

### Aksiyon

- Bu sprint için **kritik fix yok**. Yerinde düzeltme yapılmadı.
- P0 scope'unda kabul kriterleri sağlandı: 3 viewport'ta hero CTA fold içinde, taşma yok, anchor strip render ediyor, mid-page CTA'lar görünüyor.
- `personas-grid` mobile sıkışıklığı + `rubrics-grid` 2-col tercihi → P1+ "mobile responsive polish" issue'sı olarak değerlendirilebilir, ancak ayrı bir sprint aksiyonu olarak şu an **TASK-6** açılmıyor (bulgular kritik değil, kullanıcı UX testinde geri bildirim olursa açılır).
