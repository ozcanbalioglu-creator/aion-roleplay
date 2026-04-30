# PR #1 Sonrası Tespit Edilen UX/UI İyileştirmeleri — 2026-04-30

> **Bağlam:** PR #1 (rapor mimarisi + landing page + bağlı düzeltmeler) Vercel preview üzerinde test edildiği sırada kullanıcı tarafından tespit edilen ek iş kalemleri.
>
> **Statü:** Bekleyen iş listesi. Bazı maddeler P0 (canlı yayın blocker'ı), bazıları P2 (post-launch).
>
> **Tarih:** 2026-04-30, akşam test seansı.

---

## Öncelik Tablosu

| Kod | Başlık | Öncelik | Tahmini Süre |
|---|---|---|---|
| B1 | Dashboard MobileNav overlay (FOUC fix yetmedi) | 🔴 P0 | 30 dk |
| B2 | "Bu hafta seans tamamlamadınız" yanlış uyarı | 🔴 P1 | 20 dk |
| B3 | Persona "İlk Kez 5" filtresi yanlış sayaç | 🔴 P1 | 30 dk |
| B4 | Dashboard KPI'lar güncellenmemiş veya statik | 🟡 P1 | 1-2 saat |
| U1 | XP → "Deneyim Puanı" / "DP" terminoloji dönüşümü | 🟡 P1 | 2-3 saat |
| U2 | "Tenant" → "Kurum" UI metin dönüşümü | 🟡 P1 | 1-2 saat |
| F1 | Gelişimim sayfası içerik genişletme | 🟢 P2 | 1 gün |
| F2 | Sesli rapor + transkript metin gösterimi | 🟢 P2 | 3-4 saat |
| F3 | Dashboard AI yorumları (insights) | 🔵 R&D | Post-launch |

---

## 🔴 P0 — Acil (canlı yayın öncesi blocker)

### B1 — Dashboard MobileNav Overlay FOUC (Yenilenmiş)

**Bağlam:** Önceki commit (`0e2e366`) MobileNav class'ını `md:hidden` → `hidden max-md:flex` olarak değiştirdi, ama bug hâlâ tetikleniyor. Kullanıcı yeni preview'de Dashboard'a girince ekran ortasında 4 mobile ikon + 1 Profil ikonu overlay olarak gözüktü. Hard refresh kayboltuyor — yine cache/FOUC pattern'i ama farklı bir kaynaktan.

**Olası alternatifler (önceki fix yetmediği için derinlemesine):**

1. **`useIsMobile` ile koşullu render:**
   ```tsx
   'use client'
   import { useIsMobile } from '@/hooks/use-mobile'
   export function MobileNav() {
     const isMobile = useIsMobile()
     if (!isMobile) return null
     // ...
   }
   ```
   SSR'da hiç render etmez, hydration sonrası mobile ise mount eder. Tek dezavantaj: `useEffect` tetiklenene kadar gözükmez ama bug da görülmez.

2. **CSS-only solution: container query veya `@media` direkt inline:**
   ```tsx
   <nav style={{ display: 'none' }} className="max-md:!flex ...">
   ```
   Inline `display: none` SSR'da garanti gizli, sonra Tailwind class override eder.

3. **Dashboard layout'ta `<MobileNav />` çağrısını `Suspense + useIsMobile` ile sar.**

**Öneri:** Seçenek 1 (`useIsMobile` koşullu render) — en açık, hydration mismatch SHOULD work çünkü `useIsMobile` ilk render'da `false` döner.

**Dosya:** `src/components/layout/mobile-nav.tsx`

---

## 🟡 P1 — Yüksek Öncelik

### B2 — Seanslarım: "Bu hafta seans tamamlamadınız" Yanlış Uyarı

**Bağlam:** Seanslarım sayfasının üstünde turuncu uyarı: "Bu hafta henüz seans tamamlamadınız. 27 Nisan haftası — haftalık minimum 1 seans hedefini tamamlayın." Ama kullanıcı bugün (30 Nisan) 3-4 seans tamamlamış. Sayaç güncel değil.

**Olası kök neden:**
- Haftalık seans sayacı `gamification_profiles.weekly_session_count` SmallInt
- Reset mantığı veya filter (e.g. `created_at >= week_start`) yanlış olabilir
- Veya sayaç görüntüsü cache'li/stale

**Aksiyon:**
1. Seanslarım sayfası query'sine bak — haftalık sayaç nereden geliyor?
2. SQL: `SELECT COUNT(*) FROM sessions WHERE user_id = X AND status IN ('completed','debrief_completed') AND completed_at >= date_trunc('week', now())` çalışıyor mu kontrol et
3. Stale cache varsa: query revalidatePath veya re-fetch

**Dosyalar:** `src/app/(dashboard)/dashboard/sessions/page.tsx` veya benzeri

---

### B3 — Persona Seçim "İlk Kez 5" Filtresi Yanlış Sayaç

**Bağlam:** "Seans Başlat" sayfasında üst filtre butonları "Tümü 5 / İlk Kez 5 / Gelişim 0 / Tekrar Dene 0". "İlk Kez 5" ile her bir personanın altında "İlk kez dene" rozetleri var — ama kullanıcı zaten tüm 5 personayla seans yapmış. Sayaç yanlış sayıyor.

**Olası kök neden:**
- "İlk kez" hesabı `user_persona_stats` tablosunu kullanıyor olabilir
- Migration 049 öncesi yapılan seansların user_persona_stats kayıtları yoksa (gamification chain çalışmadığı için) bu rakam 0 değil yanlış pozitif görünür
- Veya filter logic'i `completed_sessions = 0` yerine `IS NULL` kontrol ediyor

**Aksiyon:**
1. Persona kartında "İlk kez dene" rozeti hangi koşulla gösteriliyor incele
2. `user_persona_stats` tablosunda bu kullanıcı için kaç kayıt var, kontrol et
3. Sayım mantığını düzelt: `seansSayisi(user, persona) > 0` → "Tekrar Dene", aksi → "İlk Kez"

**Dosyalar:** `src/app/(dashboard)/dashboard/sessions/new/page.tsx`, `src/lib/queries/persona.queries.ts`

---

### B4 — Dashboard KPI'ları Güncellenmemiş

**Bağlam:** Ana Dashboard ("Ayna Paneli") sayfasında KPI'lar: Ort. Koçluk Puanı (—), Tamamlanan Seans (0), Aktif Seri (4 GÜN), Toplam XP (687). "Tamamlanan Seans = 0" yanlış — kullanıcının onlarca seansı var.

**Olası kök neden:**
- `getDashboardStats` query'si yanlış status filter kullanıyor olabilir (`completed` only, `debrief_completed` dahil değil)
- Cache stale (revalidatePath eksik)

**Aksiyon:**
1. `src/lib/queries/dashboard.queries.ts` — `getDashboardStats` fonksiyonu kontrol et
2. Status filter: `IN ('completed', 'debrief_completed')` mi?
3. Ortalama puan: `evaluations.overall_score` AVG hesabı doğru mu?

**Dosyalar:** `src/lib/queries/dashboard.queries.ts`

---

### U1 — XP → "Deneyim Puanı" / "DP" Terminoloji Dönüşümü

**Bağlam:** "XP" oyun dünyasından gelen kısaltma — kurumsal kullanıcılar (HR, yöneticiler) "XP" tabirine yabancı. "Deneyim Puanı" daha açıklayıcı.

**Strateji:**
- UI'da görünen "XP" → "DP" (kısaltma) veya "Deneyim Puanı" (uzun form)
- İlk gözüktüğü yerde tooltip veya alt yazı: **"DP = Deneyim Puanı"**
- DB kolonu (`xp_points`) ve internal değişken adları **DEĞİŞTİRİLMEZ** — sadece görünür metin

**Etkilenen yerler (UI):**
- Başarılarım sayfası: "TOPLAM XP" → "TOPLAM DP"
- Dashboard KPI: "Toplam XP" → "Toplam DP"
- Sidebar bottom level bar: "172 XP / 300 XP" → "172 DP / 300 DP"
- LevelBar component
- XP Akışı kartı: "+50 XP" → "+50 DP"

**Aksiyon:**
1. Bu metin string'lerin geçtiği yerleri bul (`grep -rn "XP" src/ --include="*.tsx"`)
2. Sadece JSX text content + label içindekileri değiştir
3. Bir yerde tooltip ekle: "DP = Deneyim Puanı"
4. CLAUDE.md'ye terminoloji notu ekle (gelecek geliştiriciler için)

---

### U2 — "Tenant" → "Kurum" UI Metin Dönüşümü

**Bağlam:** Sidebar'da "Tenant Yönetimi" yazıyor. "Tenant" SaaS jargonu — Türkçe kurumsal kullanıcılar için "Kurum" daha doğal.

**Önemli kapsam ayrımı:**
- ❌ **DEĞİŞMEZ:** DB tablosu `tenants`, kolon `tenant_id`, RLS policy isimleri, TypeScript type `Tenant`, internal değişken `tenantId`, fonksiyon `getTenant()` — bunlar kod düzeyinde, dokunulmaz
- ✅ **DEĞİŞİR:** UI'da görünen text — "Tenant Yönetimi" → "Kurum Yönetimi", "Tenant Profili" → "Kurum Profili", page başlıkları, sidebar etiketleri, form alan etiketleri

**Etkilenen yerler:**
- `src/lib/navigation.ts` veya benzeri (sidebar nav config)
- `src/app/(dashboard)/tenant/...` page başlıkları
- `src/components/admin/CreateTenantDialog.tsx` form etiketleri
- Tüm "Tenant" yazan JSX içerik

**Aksiyon (önerilen yaklaşım — Python script DEĞİL, manuel inceleme):**
1. `grep -rn "Tenant" src/ --include="*.tsx"` ile tüm yerleri listele
2. Her bir yerin **JSX text** mi yoksa **TypeScript identifier** mi olduğunu görsel kontrol et
3. JSX text olanları "Kurum" yap; identifier (TypeScript fonksiyon/değişken/import) olanlara dokunma

> **Python script önerimi:** Yapılmamalı çünkü `Tenant` hem JSX text (UI) hem TypeScript symbol (kod) olarak kullanılıyor. Otomatik replace `TenantContext`, `useTenant`, `TenantProvider` gibi component/hook isimlerini de bozar — proje breaks. Manuel inceleme + targeted edit en güvenli yol. ~30-50 yer civarında olmalı.

**Acceptance:** "Tenant" kelimesi UI'da artık görünmesin; kod tabanında olduğu gibi dursun.

---

## 🟢 P2 — Orta Öncelik (İçerik Genişletme)

### F1 — Gelişimim Sayfası İçerik Genişletme

**Bağlam:** Mevcut Gelişimim sayfası çok boş: Seviye / Toplam DP / Tamamlanan Seans / Ortalama Puan + sağda "Yarıda Bırakılan Seanslar" + boş bir gelişim yolculuğu kartı.

**İçerik önerileri (öncelik sırasıyla):**

1. **Skor Gelişim Trendi** (line chart): Son 10 seansın overall_score'u zaman ekseninde
2. **Boyut Bazlı Gelişim Kartları**: 8 ICF boyutu için ortalama skorlar + delta (önceki 5 seans vs son 5 seans)
3. **Persona Bazlı Performans**: Her persona için ortalama skor + seans sayısı
4. **Senaryo Çeşitliliği**: Hangi senaryoları denedi, hangi zorluk seviyelerinde
5. **AI tarafından üretilmiş "Gelişim Yolculuğu" özet**: Son 5 seansın aggregated insight'ı (`development_plan` tablosu zaten var, migration 037)
6. **Aylık seans dağılım grafiği**
7. **En güçlü / en zayıf boyut listesi** (radar chart variant)

**Aksiyon:**
1. `getDevelopmentPlan` query'si zaten var — onu Gelişimim sayfasına bağla
2. Yeni component'lar: `ScoreTrendChart`, `DimensionGrowthCards`, `PersonaPerformanceTable`
3. `dashboard.queries.ts` zaten benzer query'ler içeriyor — paylaşılan yardımcılar olabilir

**Dosyalar:** `src/app/(dashboard)/dashboard/progress/page.tsx`

---

### F2 — Sesli Rapor + Transkript Metin Gösterimi

**Bağlam:** Sesli rapor dinlerken kullanıcı bazı cümleleri anlayamıyor. Metnin de görünür olması istiyor — accessibility + okunabilirlik.

**Aksiyon:**
1. `ReportAudioPlayer` component'ine "Metni Göster" toggle ekle
2. `buildReportNarration()` zaten metni üretiyor — POST endpoint'ine eklenip MP3 ile birlikte storage'a TXT olarak yazılabilir, veya runtime'da hesaplanır
3. Daha basit: Metni rapor sayfasında collapsable bir kart olarak göster — ses dinlerken aşağıda metin scroll olur

**İlerideki opsiyon:** ElevenLabs Speech-to-Text Alignment API ile timestamp'lere göre senkron highlight (karaoke gibi). Ama bu ileri seviye, post-launch.

**Dosyalar:** `src/components/sessions/report/ReportAudioPlayer.tsx`, `src/lib/session/report-audio.builder.ts`

---

### F3 — Dashboard AI Yorumları (Insights) — R&D

**Bağlam:** Dashboard KPI'larının yanına "AI Yorumu" kartları eklenebilir — son seansların eğilimine göre üretilen kişisel insight'lar.

**Örnek:**
> "Son 3 seansda **aktif dinleme** boyutunda %20 artış var. Murat Kaya ile yapılan seanslarda en yüksek skorları alıyorsun — daha çok zorlu personalarla pratik yapmayı dene."

**Aksiyon:** Post-launch için ayrı bir feature. `development_plans` tablosundaki AI özetler benzer mantık kullanıyor; bu Dashboard'a "highlight" olarak entegre edilebilir.

---

## 🔵 R&D — Karar Bekleyen

### F3 — Dashboard AI Insights (yukarıdaki F3)
### F4 — Sesli rapor karaoke-style sync (yukarıdaki F2 ileri seviye)

---

## Eylem Sıralaması

**Bu sprint (1 Mayıs öncesi son rötuş):**
1. B1 (overlay) — 30 dk
2. B2 (haftalık sayaç) — 20 dk
3. B4 (Dashboard KPI) — 1-2 saat

**1 Mayıs sonrası ilk hafta:**
4. B3 (persona filtresi) — 30 dk
5. U1 (XP → DP) — 2 saat
6. U2 (Tenant → Kurum) — 1-2 saat

**Lansman sonrası ilk ay:**
7. F1 (Gelişimim içerik) — 1 gün
8. F2 (Sesli rapor metin) — 3-4 saat
9. F3 (AI insights) — Phase 3

---

## Süreç

Her madde tamamlandığında:
1. Kod fix → typecheck + lint → commit (`fix(...)` veya `feat(...)`)
2. Bu belgede ilgili maddenin başlığına ✅ ekle
3. Kapanan maddeleri `Post_Launch_Iyilestirmeler.md`'ye **veya** `CLAUDE.md` "Hata Kaydı"na taşı (kalıcı log için)

---

## İlgili Belgeler

- [`Post_Launch_Iyilestirmeler.md`](Post_Launch_Iyilestirmeler.md) — Genel post-launch listesi
- [`canli_yayina_cikis_plani_20260425.md`](canli_yayina_cikis_plani_20260425.md) — Aktif sprint planı
- `CLAUDE.md` → Hata Kaydı — 2026-04-30 — Bu PR'da çözülen bug'lar

_Hazırlayan: Claude (test seansı sırasında kullanıcı geri bildirimi) · 2026-04-30_
