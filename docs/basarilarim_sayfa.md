# Başarılarım Sayfası — Stitch Prompt

Bu belge, AION Mirror platformunun **Başarılarım** (`/dashboard/achievements`)
sayfasını sıfırdan yeniden tasarlamak için Stitch (UI/UX generator) tarafından
kullanılacak detaylı bir içerik + bağlam + tech stack brief'idir. Stitch'e bu
dosyanın TAMAMINI prompt olarak ver.

> **Stitch için kritik not:** Bu prompt sayfanın **içeriğini, mantığını ve
> bileşen davranışlarını** tarif eder. Görsel tasarım kararları (renk paleti,
> tipografi, arka plan, illustrasyon stili, mood) tamamen sana bırakılmıştır
> — projenin mevcut tasarım sistemine bağlı kalma; **özgün ve yaratıcı bir
> tasarım** üret. İçerik akışı ve veri yapısı korunmalı, görsel dil özgürdür.

---

## 1. Ürün Bağlamı

**AION Mirror**, yöneticilerin **koçluk becerilerini** AI personalarıyla pratiğe
dökerek geliştirdiği bir SaaS platformudur. Kullanıcı seans yapar, AI persona
çalışan rolünde davranır, kullanıcı koçluk yapar. Seans sonrası ICF rubric
tabanlı değerlendirme + sesli rapor + gelişim planı üretilir. Gamification
katmanı (XP, level, rozet, görev, sıralama) kullanıcıyı düzenli pratiğe motive
eder.

**Başarılarım sayfası** — kullanıcının gamification durumunu ve gelişim
serüvenini tek bakışta gördüğü, motivasyon merkezi.

**Hedef kitle:** Kurumsal kullanıcılar (yöneticiler, satış mümessilleri, İK
profesyonelleri). Yaş 25–55. Türkçe arayüz. "Oyun gibi" hissetmesi gerek
ama profesyonel bir kurumsal tonu da koruması lazım.

---

## 2. Teknik Altyapı (Stitch'in çıktısının uyacağı stack)

| Katman | Teknoloji |
|---|---|
| Framework | **Next.js 16** (App Router, React Server Components) |
| Language | **TypeScript** (strict) |
| Styling | **Tailwind CSS v4** (utility-first) |
| Component lib | **shadcn/ui** (Radix-based primitives — Card, Avatar, Button, Tabs vb.) |
| Icons | **lucide-react** (Trophy, Crown, Medal, Zap, Target, ...) |
| Data | **Supabase** (PostgreSQL + RLS) — server-side fetch |
| Charts (varsa) | **recharts** |
| Fonts | Google Fonts via `next/font` (Manrope = body, Newsreader = headline) |

**Component konvansiyonu:**
- Server-first: data fetching server component'te (`async function Page()`)
- Interaktif kısımlar (tab geçişleri, hover efektler) `'use client'` ile
  ayrılır
- Form'lar `react-hook-form` + Zod
- Toast: `sonner`

**Klasör yapısı:**
- Sayfa: `src/app/(dashboard)/dashboard/achievements/page.tsx`
- Component'ler: `src/components/dashboard/<ComponentName>.tsx`
- Query'ler: `src/lib/queries/<feature>.queries.ts`
- shadcn primitives: `src/components/ui/`

---

## 3. Sayfa URL ve Erişim

- **Path:** `/dashboard/achievements`
- **Layout:** `(dashboard)` route group — sidebar + AppHeader otomatik gelir
- **Erişim:** Tüm authenticated kullanıcılar
- **Feature flag:** `features.gamification` — kapalıysa `notFound()`

---

## 4. Veri Modeli (Stitch için sözleşme)

Stitch'in üreteceği layout şu props/data shape'leriyle uyumlu olmalı.

### 4.1 `currentUser` (Auth)
```ts
{
  id: string
  full_name: string         // örn "Özcan Balıoğlu"
  email: string
  avatar_url: string | null // Supabase Storage URL
  tenant_id: string         // kurum ID (multi-tenant SaaS)
  role: 'user' | 'manager' | 'hr_admin' | 'hr_viewer' | 'tenant_admin' | 'super_admin'
}
```

### 4.2 `gamificationProfile` — Kullanıcının özet durumu
```ts
{
  xp_points: number          // örn 866 (toplam Deneyim Puanı, kümülatif)
  level: 1 | 2 | 3 | 4 | 5
  current_streak: number     // örn 5 (üst üste pratik gün sayısı)
  weekly_session_count: number
  // Türetilmiş alanlar:
  currentLevelXP: number     // bu level'in alt sınırı (ör 800)
  nextLevelXP: number        // bir sonraki level'in alt sınırı (ör 1800)
  progressPercent: number    // 0-100 (level çubuğu için)
}
```

**Level eşikleri:** 0 / 300 / 800 / 1800 / 3500 (= XP threshold'lar)

**Level isimleri (Türkçe):**
1. Koçluk Yolcusu
2. Gelişen Koç
3. Yetkin Koç
4. Uzman Koç
5. Usta Koç

### 4.3 `userBadges` — Kazanılan rozetler
```ts
Array<{
  id: string
  earned_at: string  // ISO timestamp
  badges: {
    code: string
    name: string         // örn "Bronz Rozet", "Beşinci Seans", "Üç Günlük Seri"
    description: string  // örn "İlk Seansını bitirince"
    category: string     // örn "milestone", "streak", "level"
    icon: string         // emoji veya icon adı (ör "🏅", "🥉", "🔥")
    xp_reward: number
  }
}>
```

**Yaygın rozet örnekleri** (kullanıcı görseli için referans):
- Seviye 2 / Seviye 3 / Seviye 4 / Seviye 5 (madalya ikonu)
- İlk Adım (hedef ikonu) — ilk koçluk seansı
- Üç Günlük Seri (alev ikonu)
- Beşinci Seans (yıldız ikonu)
- Bronz / Gümüş / Altın Rozet (madalya ikonu)

### 4.4 `xpHistory` — Son DP hareketleri (compact list)
```ts
Array<{
  points: number
  transaction_type: 'session_complete' | 'badge_award' | 'challenge_complete' | 'streak_bonus'
  description: string  // örn "Seans tamamlandı: Selin Çelik / Klinik Diyalog"
  created_at: string
}>
// Max 20 son hareket
```

### 4.5 `completedChallenges` — Tamamlanmış görevler
```ts
Array<{
  id: string
  completed_at: string
  challenges: {
    title: string         // örn "Bu hafta 3 seans tamamla"
    description: string
    challenge_type: 'weekly' | 'monthly' | 'daily' | 'milestone' | 'streak'
    xp_reward: number
  }
}>
```

### 4.6 `leaderboard` — Sıralama tablosu (3 dönem)
```ts
{
  week: LeaderboardResult
  month: LeaderboardResult
  all: LeaderboardResult
}

interface LeaderboardResult {
  period: 'week' | 'month' | 'all'
  entries: Array<{
    user_id: string
    full_name: string
    avatar_url: string | null
    xp: number             // dönem için XP miktarı
    level: number
    rank: number           // 1-based
    is_current_user: boolean
  }>                       // top 10
  current_user_entry: LeaderboardEntry | null  // top 10'da değilse ekstra göster
  total_users: number      // aynı tenant'taki toplam kullanıcı sayısı
}
```

**Önemli:** Leaderboard **aynı tenant** (kurum) içindeki kullanıcılarla
sınırlıdır. Cross-tenant sıralama yapılmaz. Kullanıcı kendi şirketindeki
diğer koçlarla yarışır.

---

## 5. Sayfa İçerik Bölümleri (Stitch buradan yola çıkacak)

Aşağıda **mantıksal** bölümler var. Stitch bunları farklı yerleşim/gruplama ile
düzenleyebilir; ama tüm bilgi sayfada bulunmalıdır.

### Bölüm A — Sayfa Başlığı
- **Başlık:** "Başarılarım"
- **Alt başlık:** "Gelişim serüvenini ve kazandığın ödülleri buradan takip
  edebilirsin."

### Bölüm B — Kullanıcı Profil + KPI Özet
**Amaç:** Kullanıcının kim olduğu, hangi seviyede ve mevcut metrikleri tek
bakışta görsün.

**İçerikler:**
- **Avatar/Level göstergesi:** Kullanıcının avatar'ı veya level emoji'si
  (`🌱 ⭐ 🏅 🏆 👑`). Seviye numarası prominent gösterilmeli.
- **Kullanıcı adı:** `currentUser.full_name`
- **Seviye etiketi:** "Yetkin Koç" gibi (yukarıdaki LEVEL_TITLE map'inden)
- **3 Anahtar Metrik (KPI'lar):**
  1. **Deneyim Puanı** — `xp_points` (örn 866). NOT: "XP" veya "DP"
     kısaltması kullanma; tam metin **"Deneyim Puanı"**.
  2. **Gün Seri** — `current_streak` (örn 5)
  3. **Rozet** — `userBadges.length` (örn 8)
- **Seviye İlerleme Çubuğu (Progress Bar):** Bir sonraki seviyeye ne kadar
  kalmış (`progressPercent` 0-100). Altında metin: `"{xp_points} / {nextLevelXP} DP"`.

### Bölüm C — Rozet Koleksiyonu (kart/grid)
**Amaç:** Kullanıcının kazandığı tüm rozetleri görsel olarak sergile.

**İçerik per rozet kartı:**
- **İkon/Emoji** (büyük, prominent — `badge.icon`)
- **Rozet adı** (`badge.name`)
- **Açıklama** (`badge.description` — kısa, italic)
- **Kazanım tarihi** — Türkçe locale ("30 Nisan", "1 Mayıs")
- **Hover etkisi** önerilir (hafif scale/glow)

**Sayaç:** Sağ üstte "8 Ödül" gibi bir badge.

**Boş durum:** "Şu an henüz bir rozet kazanmadın. Seanslara devam ederek
koleksiyonunu oluştur!" + ilustratif ikon.

### Bölüm D — Görev Tamamlamaları (kart/grid)
**Amaç:** Bitirilmiş haftalık/aylık/günlük görevleri sergile (rozet
koleksiyonu ile **iki ayrı kutu**, paralel görsel ağırlıkta).

**İçerik per görev kartı:**
- **Tip ikonu/emoji** (`challenge_type`'a göre — weekly: 🗓️, monthly: 📅,
  daily: ☀️, milestone: 🎯, streak: 🔥)
- **Görev başlığı** (`challenges.title`)
- **Açıklama** (`challenges.description`)
- **XP ödülü** badge — "+50 DP" gibi
- **Tamamlanma tarihi**

**Sayaç:** "12 Görev" gibi.

**Boş durum:** "Henüz tamamlanmış görev yok. Haftalık görevlerini bitirdikçe
burası dolar!"

### Bölüm E — Sıralama Tablosu (Leaderboard)
**Amaç:** Aynı kurumdaki kullanıcılar arasında nerede olduğunu göster,
rekabet hissi yarat.

**Üst Bölüm — Sekmeler:**
3 segment, biri seçili:
- **Bu Hafta** (`week`)
- **Bu Ay** (`month`)
- **Tüm Zamanlar** (`all`)

**Liste — Top 10:**
Her satır:
- **Sıralama:** 1. → Crown (taç) ikonu, 2. → Gümüş madalya, 3. → Bronz
  madalya, 4+ → "#4", "#5" şeklinde sayı
- **Avatar** (yoksa baş harfler)
- **İsim** + altında "Seviye 3" gibi metin
- **XP miktarı** (sağda, büyük + tabular-nums) — "Deneyim Puanı" altyazısıyla

**Mevcut kullanıcı vurgusu:**
- Eğer top 10'daysa: kendi satırı belirgin amber/altın highlight + "SEN" rozeti
- Eğer top 10'da değilse: liste sonuna kesik çizgi ayırıcı ("- senin yerin -")
  ardından kendi satırı (#15 gibi)

**Alt bilgi:** "Aynı kurumdan {totalUsers} kullanıcı yarışıyor"

**Boş durum (yeni kurum):** "Bu dönem için henüz puan yok. Seans
tamamlayanlar burada görünecek."

### Bölüm F — Deneyim Puanı Akışı
**Amaç:** Son XP hareketlerini compact bir liste hâlinde gösterir
(transparency — "neyle puan kazandım?").

**İçerik per satır:**
- **Açıklama** (`description`) — "Seans tamamlandı: Selin Çelik / Klinik Diyalog"
- **Tarih** (kısa, örn "30 Nis")
- **+XP badge** (sağda, amber tonlarında) — "+50"

Max 20 son hareket. **Başlık:** "Deneyim Puanı Akışı"

**Boş durum:** "Henüz deneyim puanı hareketi yok."

### Bölüm G — Terminoloji Notu (footer)
Sayfanın altında küçük bir italic metin:
> "Deneyim Puanı (DP) — Tamamladığın seanslara ve görevlere göre kazandığın
> gelişim puanı."

---

## 6. Davranış / Etkileşim Notları

| Bölüm | Davranış |
|---|---|
| Profil + KPI | Statik, server-rendered |
| Rozet kartı | Hover'da hafif animasyon (scale/glow); tıklanırsa modal yok (faz 1) |
| Görev kartı | Aynı şekilde hover effect, tıklama yok |
| Leaderboard sekmeler | Lokal state ile değişim — server'da 3 dönem önceden çekilir, sekmeler arası geçiş anlık |
| Leaderboard satır | Hover'da arka plan renk değişimi |
| DP Akışı | Statik, scrollable list (uzun olabilir) |

---

## 7. Responsive Beklentileri

- **Mobile (< 640px):** Tüm bloklar dikey stack. KPI'lar yatay 3 sütun
  kalabilir ya da 1-3 dikey.
- **Tablet (640-1024px):** Profil yatay; rozet/görev tek sütuna inebilir
  veya 2 sütun kalabilir; leaderboard full width.
- **Desktop (> 1024px):** Geniş layout — rozet ve görev yan yana, leaderboard
  + DP akışı yan yana.

---

## 8. İçerik Mantığı / Karar Ağacı

```
Kullanıcı yeni mi?
├─ profile.xp_points === 0
│   → Boş durumlar prominent: "İlk seansını yap!"
│   → Rozet/görev empty state göster
│   → Leaderboard'da en altta "—" sırası
│
├─ profile.xp_points > 0
│   → Normal görünüm
│   → Tüm bölümler dolu (veya kısmen dolu)
│
└─ profile.level === 5 (max)
    → Progress bar %100, "Usta Koç" başlığı
    → Bir sonraki level metni: "Seviye Tamamlandı"
```

---

## 9. Türkçe İçerik Kuralları

- **"DP" kısaltması yerine "Deneyim Puanı"** (uzun form). Sadece çok dar
  yerlerde (badge içinde) "DP" kabul edilir + footer'da açıklama olmalı.
- **"XP" kullanma**, sadece kod tarafında değişken adı (`xp_points`).
- **"Tenant" kelimesi UI'da yok** → "Kurum" kullan.
- **Tarih formatı:** Türkçe locale (`tr-TR`), kısa form ("30 Nis", "1 May")
  veya uzun ("30 Nisan", "1 Mayıs").
- **Sayılar:** `tabular-nums` (sayı sütunlarında font genişlikleri eşit
  olmalı).
- **Ton:** Profesyonel ama sıcak. Yarı-oyunsu ama kurumsal saygıyı
  kaybetmemiş. Buyurgan değil, motive edici. ("Seanslara devam ederek
  koleksiyonunu oluştur!" gibi)

---

## 10. Erişilebilirlik

- Avatar fallback: Kullanıcı adının ilk 2 harfi (örn "ÖB")
- Lucide icon'larında `aria-label` opsiyonel ama anlamlı yerlerde gerekli
- Leaderboard sekmeleri klavye ile erişilebilir (Tab + Enter)
- Renk kontrastı WCAG AA'ya uygun olmalı (özellikle current user
  highlight'ında)

---

## 11. Performance Beklentileri

- Server-side data fetch tek bir `Promise.all` içinde paralel
- 7 paralel query: `gamificationProfile`, `userBadges`, `xpHistory`,
  `completedChallenges`, `leaderboard.week/month/all`
- LCP < 2.5s
- Avatar görselleri lazy load, fallback ready

---

## 12. Çıktı Beklentisi (Stitch'e direktif)

Stitch'ten beklenen:
1. **Yaratıcı bir görsel dil** — projenin mevcut "deep purple + amber"
   paletinden farklı bir yön denemekten çekinme. Renk paleti, tipografi,
   illustrasyon stili, motion ipuçları — özgürsün.
2. **Yukarıdaki tüm bölümler** sayfada bulunmalı.
3. **Veri shape'leri** korunmalı — kod entegrasyonu mümkün olsun.
4. **Türkçe içerik** kullanılmalı (örnek metinler dahil).
5. **Responsive** akış net olmalı.
6. **Component yapısı** Next.js + Tailwind + shadcn'e uyumlu olmalı (export
   edilebilir component'ler, RSC-friendly).

---

## 13. Mevcut Implementasyon Referansı

Stitch'in çıktısıyla karşılaştırma için, mevcut sayfanın dosyaları:

- `src/app/(dashboard)/dashboard/achievements/page.tsx` — server component, 7
  paralel query, 3 ROW layout
- `src/components/dashboard/Leaderboard.tsx` — client tab component
- `src/components/dashboard/CompletedChallengesGrid.tsx` — challenge grid
- `src/lib/queries/leaderboard.queries.ts` — tenant-bound leaderboard query
- `src/lib/queries/gamification.queries.ts` — profile, badges, XP history,
  completed challenges
- `src/components/ui/LevelBar.tsx` — progress bar primitive

Mevcut layout 3 satıra ayrılmış: (1) yatay KPI, (2) rozet+görev iki kutu,
(3) leaderboard + DP akışı. Stitch bu yerleşimi tamamen değiştirebilir;
yeter ki tüm bölümler (B-G) sayfada bulunsun.

---

## 14. Stitch için Hazır Prompt Cümlesi

> "Build a Turkish-language gamification achievements dashboard page for a
> corporate B2B coaching SaaS platform (AION Mirror). The page is at
> `/dashboard/achievements` in a Next.js 16 App Router app using TypeScript,
> Tailwind CSS v4, and shadcn/ui components. The page must include the
> following sections: (B) user profile with level avatar, name, level title,
> and 3 horizontal KPI metrics (Deneyim Puanı, Gün Seri, Rozet) plus a level
> progress bar; (C) badge collection grid showing earned badges with icon,
> name, description, and earned date; (D) completed challenges grid (parallel
> to badges) with challenge type emoji, title, description, XP reward, and
> completion date; (E) tenant-scoped leaderboard with three tabs (Bu Hafta /
> Bu Ay / Tüm Zamanlar) showing top 10 ranked users with crown/medal icons
> for top 3, current user highlighted, and current user's row appended below
> if not in top 10; (F) experience point activity feed listing recent XP
> transactions with description, date, and +XP badge. Use the data shapes,
> Turkish content rules, and behavior described in the full brief. Be
> creative with visual design — color palette, typography, illustration
> style, and motion are entirely your choice. Make it feel professional yet
> warmly motivating, suitable for managers aged 25-55."

Stitch çalışırken bu özet cümleyi pencereye yapıştır + tam dosyayı bağlam
olarak sağla.
