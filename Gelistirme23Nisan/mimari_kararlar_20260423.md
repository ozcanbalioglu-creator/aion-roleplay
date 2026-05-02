# Mimari Kararlar — roleplay-saas
> Tarih: 2026-04-23
> Önceki belge: `Gelistirme23Nisan/system_analiz_20260423.md`
> Sonraki belge: Workflow Architect / Project Shepherd tarafından yazılacak

---

## 1. Executive Summary

**Mevcut mimari olgunluk:** AION Mirror, **yapısal olarak sağlam fakat operasyonel olarak kırılgan** bir Next.js 16 App Router + Supabase SaaS'ıdır. Çekirdek domain akışları (auth, session lifecycle, SSE chat, QStash tabanlı evaluation) kod düzeyinde tamamlanmış; RLS + service-role ayrımı, adapter pattern (LLM/STT/TTS), server actions + queries ayrımı, AES-GCM prompt şifrelemesi ve Zustand tabanlı client state gibi iyi örüntüler yerleşmiş durumda. Ancak çevresel (environment-aware) yapılandırma eksikleri, migration hijyensizliği, iki kaynaklı role modeli, placeholder sayfalar ve test/bildirim/mail boşlukları production-ready eşiğinin altında tutuyor. **Tek cümleyle: mimari tasarım doğru ama "deploy surface" hatalı.**

**En kritik 3 mimari risk:**
1. **Role authorization'ın iki kaynaklı olması** (middleware JWT `user_metadata.role` vs server actions `users.role`). Bu bir veri tutarlılığı değil, **güvenlik** riskidir — bir kaynak güncellenip diğeri güncellenmezse yetki çakışması yaşanır.
2. **Config/env uyumsuzluğu + hardcoded Supabase URL** — deploy'u hem engeller hem de multi-environment stratejisini imkansız kılar (staging/prod ayrımı yapılamaz).
3. **Migration hijyeni ve schema dualism** (`badges.code` vs `badges.badge_code`, çift `022_*` dosyası, iki isimlendirme rejimi) — yeni bir Supabase projesine temiz kurulum artık garanti değil; production için "reproducible schema" yok.

**Önerilen mimari evrim yönü:** Bu bir **modüler monolit** olarak kalmalı. Microservice, event-driven genişletme veya DDD aggregate refactor'u bu projenin büyüklüğüne göre overkill. Yapılacak iş, **mevcut mimariyi "sertleştirmek"**: tek gerçeklik kaynağı (role), environment-aware config, idempotent + timestamp-based migrations, placeholder'ların feature-flag'li teslimi, ve test/CI pipeline'ının eklenmesi. Bounded context'ler (`modules/`) şimdilik iskelet olarak korunabilir; dolduru `session.actions.ts` gibi şişmiş dosyaları parçalamak için koşulan bir sonraki refactor sprintine bırakılır.

---

## 2. Mevcut Mimari Haritası

### 2.1 Katman Şeması

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React 19, Zustand, react-hook-form, shadcn/ui)        │
│  - SSE tüketimi (chat stream)                                   │
│  - MediaRecorder + VAD (voice mode)                             │
└─────────────────────────────────────────────────────────────────┘
                         │  HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 16 App Router                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ middleware.ts — Supabase session refresh + coarse role    │  │
│  │                 gate (JWT user_metadata.role)             │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────┬───────────────────┬───────────────────────┐  │
│  │ (auth) layout │ (dashboard) layout│ api/ (route handlers) │  │
│  │ login/consent │ sidebar+header+   │ chat SSE | evaluate   │  │
│  │               │ NotificationPoller│ stt | tts | cron/*    │  │
│  └───────────────┴───────────────────┴───────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Server Actions (src/lib/actions/*)  — yazmalar             │  │
│  │ Queries       (src/lib/queries/*)    — okumalar            │  │
│  │ Adapters      (src/adapters/ + src/lib/adapters/ — ÇİFT)  │  │
│  │ Services      (evaluation.engine, gamification.service …)  │  │
│  │ Encryption    (AES-GCM for prompts & transcripts)          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       │  SSR client (RLS)        │  Service-role (RLS bypass)
       ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase (tek proje, hardcoded host)                           │
│  - Postgres (30+ migration, enum'lar, RLS, trigger'lar)         │
│  - Auth (email/password; SSO butonu dummy)                      │
│  - Storage (avatars public bucket; personas runtime-created)    │
│  - Realtime: KULLANILMIYOR                                      │
│  - Edge Functions: YOK                                          │
└─────────────────────────────────────────────────────────────────┘
       │                                     ▲
       │ publish (QStash)                    │ webhook (signed)
       ▼                                     │
┌─────────────────────────────────────────────────────────────────┐
│  Upstash QStash — async jobs                                    │
│  - evaluate (5s delay + 3 retry)                                │
│  - session-timeout cron                                         │
│  - assign-weekly-challenges cron                                │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Dış Servisler                                                  │
│  - OpenAI (LLM + Whisper)                                       │
│  - ElevenLabs (TTS)                                             │
│  - Resend: paketli ama import edilmemiş (ÖLÜ)                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Bounded Context'ler (kod + migration'lardan türetilmiş)

| Context | Sorumluluk | Ana klasörler / tablolar |
|---|---|---|
| **Identity & Access** | Login, consent, role, RLS helper fonksiyonları | `modules/auth/`, `middleware.ts`, `users`, `consent_records`, `auth_role()`, `auth_tenant_id()` |
| **Tenant & Organization** | Tenants, davetler, tenant-admin akışları | `lib/actions/tenant.actions.ts`, `lib/actions/user.actions.ts`, `tenants`, `persona_tenant_mappings` |
| **Persona & Scenario Catalog** | Persona + senaryo içerik yönetimi (global + tenant-scoped) | `lib/actions/persona.actions.ts`, `scenario.actions.ts`, `personas`, `scenarios`, `persona_kpis`, `persona_prompt_versions` |
| **Roleplay Session** | Seans yaşam döngüsü, chat SSE, transcript, voice | `lib/actions/session.actions.ts`, `api/sessions/[id]/*`, `stores/session.store.ts`, `sessions`, `session_messages`, `prompt_logs` |
| **Evaluation & Rubrics** | LLM scoring, dimension scores, rubric şablonları | `lib/evaluation/*`, `api/sessions/[id]/evaluate`, `evaluations`, `dimension_scores`, `rubric_templates`, `rubric_dimensions` |
| **Gamification** | XP, level, streak, rozet, haftalık görev | `lib/evaluation/gamification.service.ts`, `lib/gamification/challenge.service.ts`, `lib/actions/gamification.actions.ts`, `gamification_profiles`, `badges`, `challenges`, `user_challenges`, `point_transactions` |
| **Notifications** | In-app notification'lar (e-mail akışı YOK) | `components/common/NotificationPoller.tsx`, `notifications`; Resend entegrasyonu yok |
| **Observability & Compliance** | Usage metrics, audit log, KVKK data deletion | `lib/logger/`, `usage_metrics`, `audit_logs`, `data_deletion_requests` |
| **Reporting** | Manager/HR/tenant raporları + CSV export | `lib/actions/report.actions.ts` (varsa), `app/(dashboard)/reports/*`, view'lar |

### 2.3 Coupling Hotspot'ları (analiz belgesinden doğrudan türetilmiş)

- **`session.actions.ts` şişmiş:** DB kontrolü + system prompt build + şifreleme + service-role `prompt_logs` yazımı + QStash publish — hepsi tek dosyada. `src/modules/session/` iskelet boş.
- **İki adapter klasörü:** `src/adapters/` (LLM) vs `src/lib/adapters/` (STT, TTS). Chat route.ts birinciyi, STT/TTS route.ts'ler ikinciyi import ediyor. CLAUDE.md sadece birinciyi belgeliyor.
- **Role check'in iki kaynağı:** middleware `user_metadata.role` (JWT), server actions `users.role` (DB). Senkronizasyon garantisi **kod seviyesinde yok**.
- **Service-role RLS-bypass yüzeyi geniş:** 10+ dosyadan `createServiceRoleClient` çağrılıyor. Her çağrı güven gerektirir; audit trail yok.
- **Config hardcoded:** `next.config.ts` tek Supabase URL; `bootstrap-users.mjs` default `tenant_id = 00000000-...-0001`.
- **Migration pipeline parçalı:** Timestamp rejimi (`20260419...`) + plain numeric rejim (`014..022`) + çift `022_*` dosyası.

### 2.4 Zaten Yerleşmiş Pattern'ler (korunacak)

- **RLS + SSR client (`createClient`) varsayılan**, bypass sadece `createServiceRoleClient` ile explicit.
- **Server Actions mutation / plain async queries read** ayrımı — net ve belgelenmiş.
- **Adapter pattern** (LLM/STT/TTS) — `ILLMAdapter` soyutlaması, provider swap mümkün.
- **Route Group ile role-based layout** (`(auth)`, `(dashboard)/admin`, `(dashboard)/tenant`).
- **shadcn/ui + Radix** — tek UI kütüphanesi çekirdeği; `@base-ui/react` paketli ama konsolidasyon kararı sonraki fazda alınabilir.
- **AES-GCM encryption** (prompt + transcript) — ciddi bir gizlilik katmanı, gereksiz refactor etme.
- **QStash ile async evaluation** — retry + delay hali hazırda yapılmış.

---

## 3. Mimari Kararlar (ADR'lar)

Tüm ADR'ların durumu `Proposed` — kullanıcı Project Shepherd adımında onaylayacak.

---

### ADR-001: QStash Environment Variable İsimlerini Koda Hizalamak (ve `.env.local.example`'ı Kod Gerçeğine Göre Düzeltmek)

**Durum:** Proposed
**Kapsadığı bulgular:** #1
**Bağlam:** Kod `UPSTASH_QSTASH_TOKEN`, `UPSTASH_QSTASH_CURRENT_SIGNING_KEY`, `UPSTASH_QSTASH_NEXT_SIGNING_KEY`, `QSTASH_RECEIVER_URL` bekliyor. `.env.local.example` ise `QSTASH_URL`, `QSTASH_TOKEN` tanımlıyor. Bu fark **deploy blocker**: runbook'a göre env doldurulsa bile evaluation queue, session-timeout cron ve weekly-challenges cron sessizce 500 döner veya imza doğrulamazsa webhook'u kabul etmez. Kullanıcının da gözlemlediği "arka plan akışı yok" semptomunun kök sebebi tam olarak bu.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **`.env.local.example`'ı kod isimlerine göre düzenle** (tek doğruluk: kod) | En az kod değişikliği; QStash dokümantasyonu Upstash naming'ine zaten uyuyor | Daha önce `.env` dosyalarını elle kuran herkesin yeniden kurması gerekir | Düşük — sadece 1 dosya + docs |
| B | **Kodu `QSTASH_*` isimlerine döndür** | Upstash'in hem `QSTASH_*` hem `UPSTASH_QSTASH_*` aliaslarını ekosistemde görmek mümkün; kısa isimler daha okunabilir | Kod > doc değişikliği; 4+ dosya güncellemesi | Orta |
| C | **Her iki isme de fallback ekleyen `config.ts` soyutlaması** (ör. `process.env.UPSTASH_QSTASH_TOKEN ?? process.env.QSTASH_TOKEN`) | Geri uyumluluk | Tech debt; config kaynağı belirsizleşir; "magic" davranış | Orta-yüksek |

**Karar:** **Seçenek A** — `.env.local.example` kod gerçeğine hizalanır (`UPSTASH_QSTASH_TOKEN`, `UPSTASH_QSTASH_CURRENT_SIGNING_KEY`, `UPSTASH_QSTASH_NEXT_SIGNING_KEY`, `QSTASH_RECEIVER_URL`). Kullanılmayan `QSTASH_URL` ve `QSTASH_TOKEN` satırları silinir. `CLAUDE.md`'deki env listesi aynı şekilde güncellenir. Kod = tek doğruluk kaynağı.

**Sonuçlar:**
- Kolaylaşır: DevOps runbook yazımı (tek isim listesi); health endpoint'ine QStash env probu eklenebilir.
- Zorlaşır: Mevcut `.env.local` dolduranlar yeniden kurmalı — ama secret'lar zaten boş olduğundan marjinal etki.
- Yeni borç: Config doğrulaması için `env.ts` tipli Zod schema eklemek ileride istenebilir (ADR olmadan yapılabilir).

**Geri alınabilirlik:** **High** — ENV isimleri dakikalar içinde geri rename edilir.

**İlk uygulama adımları:**
1. `.env.local.example` dosyasında QStash blokunu yeniden yaz.
2. `CLAUDE.md` env listesini güncelle.
3. `/api/health` endpoint'ine QStash env varlığını probe eden check ekle (var/yok bilgisi, sır **ifşa etme**).
4. DevOps runbook'una "prod secret doldurma sırası" notunu yaz.

---

### ADR-002: `badges` Tablosunda Tek Alan Kaynağı (`code` VEYA `badge_code`, İkisi Değil) + Migration Dualism'inin Temizlenmesi

**Durum:** Proposed
**Kapsadığı bulgular:** #2, #8
**Bağlam:** `badges` tablosu tarihsel olarak önce `code TEXT NOT NULL UNIQUE` alanıyla 009'da oluşturuldu. Sonra 20260422_021 fix migration'ı `badge_code` adlı yeni bir nullable kolon ekledi fakat eski `code` kolonunu **kaldırmadı**. Sonuç: yazma action'ı hangi kolona yazarsa yazsın, diğerinin NOT NULL kısıtı patlatıyor ya da nullable kolon beklenti yaratıyor. Aynı şekilde `challenges` tablosunda `name NOT NULL` sorunu yaşandı. Migration numaralandırmasında da iki rejim var: timestamp'li (`20260419..._001_..`) ve plain (`014..022`); `022` numarası **iki dosyada** kullanılıyor (`022_fix_persona_tenant_rls.sql` + `022_update_rls_manager_access.sql`). Supabase CLI bu iki dosyayı alfanumerik sırada uygular ama timestamp'li şema ile karıştırıldığında sıra **tahmin edilemez** hale gelir. Yeni ortama temiz kurulum **hipotez**; doğrulanmadı.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **Tek kolon: `code` kalır, `badge_code` kaldırılır** — `code`'u tenant-scoped unique yap (composite unique: `(tenant_id, code)`) | En orijinal naming; eski sorgular bozulmaz | Son migration'ı reverse etmek gerekir (idempotent yapılabilir) | Düşük-orta |
| B | **Tek kolon: `badge_code` kalır, `code` kaldırılır** | Fix migration'ı zaten `badge_code`'u ekledi; modern naming "badge_code" daha spesifik | Kodda 10+ yer `code` referans edebilir; CLAUDE.md + form + query hepsi değişir | Orta |
| C | **Her iki kolon da kalır + generated column / trigger senkronizasyonu** | Geri uyumluluk | İki kolonu da canlı tutmak gelecek developer için tuzak; "code vs badge_code" tartışması sonsuza kadar açık | Yüksek |

**Karar:** **Seçenek A** — `code` tek gerçeklik kaynağı. Yeni migration dosyası `20260423_024_badges_schema_unification.sql`:
- `badges.badge_code` kolonunu (eğer varsa ve tamamen boşsa) **DROP IF EXISTS** ile kaldır.
- `badges.code` için mevcut UNIQUE constraint'i yerine **composite unique** `(tenant_id, code)` kur (`tenant_id IS NULL` global badge'ler için allow).
- `challenges` tablosunda benzer şekilde `name NOT NULL` sorununu revize et (`title` varsa `name` nullable yap + default).
- Aynı migration'da çift 022 sorununu da adresle: `022_fix_persona_tenant_rls.sql` ve `022_update_rls_manager_access.sql` zaten uygulanmış olabileceğinden rename **etme**; yerine yeni migration idempotent policy rebuild yap.

**Migration naming için kural:** **Bu noktadan sonra yalnızca timestamp'li naming** (`YYYYMMDDHHMMSS_NNN_short_name.sql`). Plain-numeric `014..022` dosyaları oldukları gibi kalır (geçmiş); geleceğe doğru tek yön.

**Sonuçlar:**
- Kolaylaşır: `createTenantBadgeAction` ve CRUD form'u çalışır; Gelistime2.md #8 ve Gelistime3.md #5 kapanır; yeni migration'lar net sırada.
- Zorlaşır: Yazılım mühendisinin migration'ı **hem lokal `.env` + Supabase SQL Editor** akışında çalıştırması gerekir; migration log'u kullanıcı tarafından korunmalı.
- Yeni borç: "Migration zaten uygulanmış mı?" bilgisini Supabase'den çekmek için bir check script'i gerekebilir (bkz. ADR-009).

**Geri alınabilirlik:** **Medium** — DROP COLUMN yaparsanız veri kaybı olur (şu an `badge_code` boş olduğundan risk düşük ama sıfır değil). Önce SELECT ile dolu mu doğrulanmalı.

**İlk uygulama adımları:**
1. Supabase'te `SELECT count(*) FROM badges WHERE badge_code IS NOT NULL` ile veri kontrolü.
2. Yeni migration dosyasını yaz (idempotent: `IF EXISTS`, `IF NOT EXISTS`).
3. `src/lib/actions/gamification.actions.ts`'deki INSERT'te `code` field'ını set et.
4. `BadgeSchema` (Zod) ve `GamificationForms.tsx` form alanını `code` ile hizala.
5. `challenges` için eşdeğer geçişi aynı migration içinde uygula.

---

### ADR-003: Boş İskelet Klasörlerini Temizleme + Escape'li Klasörü Rename

**Durum:** Proposed
**Kapsadığı bulgular:** #3
**Bağlam:** App Router içinde aşağıdaki artıklar var:
- `src/app/dashboard/` ve `src/app/manager/` (parantezsiz, gerçek rota değil) — **kaldırılacak**
- `src/app/(admin)/` ve `src/app/(manager)/` (parantezli ama içeriksiz route grup) — **kaldırılacak veya gerçekten dolacak**
- `src/app/\(dashboard\)/sessions/new/` (shell escape hatası artığı — `\(dashboard\)` adında gerçek klasör!) — **kaldırılacak**
- `src/modules/` altındaki 10 boş modül klasörü (`analytics`, `conversation`, `evaluation`, `gamification`, `notification`, `persona`, `prompt`, `scenario`, `session`, `tenant`) — **şimdilik `.gitkeep` ile korunabilir ama dökümante edilmeli**
- `src/app/api/` altındaki 9 boş route klasörü (`admin`, `evaluation`, `gamification`, `notifications`, `personas`, `reports`, `scenarios`, `voice/stt`, `voice/tts`)

**Risk:** Parantezsiz `dashboard/` veya `manager/` klasörü içinde biri `page.tsx` yaratırsa, App Router onu gerçek rota olarak resolve eder ve `(dashboard)/dashboard/page.tsx` ile **route collision** yaşanır. Aynı şekilde `\(dashboard\)` klasörü Next.js'in normal route group olarak okumadığı bir yol üretir ama dizin gürültüsü olarak builder'ları yanıltır.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **Hepsini sil** (klasörler + `.gitkeep`'ler) | En temiz; gürültü sıfır | `src/modules/*` boş klasörleri iskelet niyetini temsil ediyordu — silinirse refactor map kaybolur | Düşük |
| B | **Sadece zararlı olanları sil** (`src/app/dashboard/`, `src/app/manager/`, `\(dashboard\)`), `src/modules/*` ve `src/app/(admin|manager)/` boş haliyle kalır ama `README.md` ile niyet dökümante edilir | Denge: hem gürültü azalır, hem refactor niyeti korunur | İki kategoriyi ayırt etmek için disiplin gerekir | Düşük |
| C | **Hepsi kalır, CI'ye "route collision detector" ekle** | Hiçbir şey silinmez | Karmaşa korunur; CI karmaşası | Orta |

**Karar:** **Seçenek B** — **zararlı olanlar silinir**, **niyet iskeletleri korunur ama dökümante edilir**.

Silinecekler:
- `src/app/dashboard/` (parantezsiz — route collision riski)
- `src/app/manager/` (parantezsiz — route collision riski)
- `src/app/\(dashboard\)/` (escape bug artığı)
- `src/app/(admin)/` içeriği (zaten `.gitkeep`; admin rotaları `(dashboard)/admin/` altında yaşıyor)
- `src/app/(manager)/` içeriği (aynı sebep)

Korunacaklar + dökümante edilecekler:
- `src/modules/{session,persona,scenario,evaluation,gamification,notification,prompt,tenant,analytics,conversation}/` — bu klasörler **gelecek refactor hedefi**. Her birine tek satırlık README koy: "Bu module iskeleti, ilgili `src/lib/actions/*` ve `src/lib/queries/*` dosyalarının domain-aligned refactor hedefidir. Şimdilik boş." Bu, ADR-007'nin (Cross-cutting Principles) "Niyet belgelenmeli" prensibini uygular.

**Sonuçlar:**
- Kolaylaşır: builder'lar doğru rotaları daha hızlı bulur; route collision fırsatı ortadan kalkar.
- Zorlaşır: Yok.
- Yeni borç: `src/modules/*` refactor'u için gelecekte bir ADR/sprint gerekir; bu ADR onu planlamıyor.

**Geri alınabilirlik:** **High** — git'te zaten her şey var; rename/delete geri alınır.

**İlk uygulama adımları:**
1. `git rm -r src/app/dashboard src/app/manager "src/app/\(dashboard\)"` (escape karakterli olan için çift-tırnak).
2. `src/app/(admin)/` ve `src/app/(manager)/` içindeki `.gitkeep`'leri sil; klasörleri git'ten çıkar.
3. `src/modules/*/README.md` tek satırlık niyet notu ekle.
4. `npm run build` ile route collision olmadığını doğrula.

---

### ADR-004: Placeholder Sayfaların Feature-Flag'li Teslimi

**Durum:** Proposed
**Kapsadığı bulgular:** #4
**Bağlam:** 4 sayfa `PlaceholderPage` komponenti kullanıyor: `/dashboard/progress`, `/dashboard/notifications`, `/manager/team`, `/manager/reports`. Bu sayfalar navigation'da görünüyor (sidebar'da kullanıcı tıklıyor) ama içeriksiz — UX kırılıyor. Ayrıca `/admin/system` middleware'de korumaya alınmış ama dosyası bile yok. MVP için bu 5 yüzey ya dolmalı, ya kaldırılmalı, ya da kontrollü şekilde "Yakında" olarak işaretlenmeli.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **Hepsini MVP'de doldur** | Tam ürün duygusu | 5 sayfa × N saat = yüksek iş yükü; MVP ertelenir | Yüksek |
| B | **Hepsini sidebar'dan/nav'dan gizle** (`src/lib/navigation.ts`'ten role bazlı item'ları kaldır) | MVP hızla çıkar | Manager/HR rolleri "takım raporu" gibi beklentili item'ları kaybeder | Düşük |
| C | **Feature flag ile kontrol et** — `FEATURE_PROGRESS_ENABLED`, `FEATURE_NOTIFICATIONS_PAGE_ENABLED`, `FEATURE_MANAGER_TEAM_ENABLED` env var'ları; default `false`. Nav item'lar feature-flag'e göre render edilir. `/admin/system` rotası ya silinir ya da flag arkasında kalır. | Ortaları tutuyor: prod hızlıca çıkar, aynı codebase hem MVP hem genişletilmiş sürümü destekler; staging'te flag açılarak test edilir | Feature flag bir mini-infra; env'ler çoğalır | Orta |

**Karar:** **Seçenek C** — feature-flag'li teslim. Nav config (`src/lib/navigation.ts`) env-aware hale getirilir; `PlaceholderPage` komponenti korunur (dev/staging'te flag açılırsa görünür). Production MVP'de bu sayfalar **görünmez**. `/admin/system` rotası middleware'den de çıkarılır; `SUPER_ADMIN_ROUTES` array'i güncellenir.

Flag sözleşmesi: `FEATURE_<AREA>_ENABLED=true|false`. `.env.local.example`'da yeni flag'ler tanımlanır: `FEATURE_PROGRESS_PAGE_ENABLED`, `FEATURE_NOTIFICATIONS_PAGE_ENABLED`, `FEATURE_MANAGER_PAGES_ENABLED`. Mevcut `FEATURE_VOICE_ENABLED`, `FEATURE_GAMIFICATION_ENABLED`, `FEATURE_ANALYTICS_ENABLED` flag'leri (`.env.local.example`'da tanımlı ama koda bağlanmamış) aynı örüntüyle bağlanır.

**Sonuçlar:**
- Kolaylaşır: MVP deploy'u blok olmaz; stakeholder'a "Yakında" satmak yerine flag kapalı → sayfa yok.
- Zorlaşır: Her yeni ortam için flag tabloları; env drift riski.
- Yeni borç: Flag yönetimi için basit bir `src/lib/features.ts` helper gerekir.

**Geri alınabilirlik:** **High** — flag'i açmak/kapatmak env değişikliği.

**İlk uygulama adımları:**
1. `src/lib/features.ts` oluştur: `export const isEnabled = (flag: string) => process.env[flag] === 'true'`.
2. `src/lib/navigation.ts`'yi flag-aware yap.
3. Placeholder sayfaları **404 döndür** eğer flag kapalıysa (sayfa dosyası kalır, içinde `notFound()` çağır).
4. Middleware'den `/admin/system` kaldır veya `FEATURE_ADMIN_SYSTEM_ENABLED` arkasına al.
5. `.env.local.example` ve `CLAUDE.md` güncelle.

---

### ADR-005: Environment-Aware Supabase Host Konfigürasyonu (`next.config.ts` De-Hardcode)

**Durum:** Proposed
**Kapsadığı bulgular:** #5
**Bağlam:** `next.config.ts` şu an `hostname: 'dqmivckxqdvwlzudshlz.supabase.co'` şeklinde **tek proje için hardcoded**. Staging ve prod için ayrı Supabase projesi açılması durumunda, image optimizer remotePattern'ı farklı host'u reddeder (broken avatar'lar). Bu doğrudan multi-environment stratejisini bloke eder.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **`next.config.ts`'yi `NEXT_PUBLIC_SUPABASE_URL` okuyacak şekilde dinamik yap** (build-time) | Tek config; env değişince build sırasında doğru host gelir | `next.config.ts` CJS/ESM context'inde env parse etmek gerekir; build edilmemiş env bozuk config yaratır | Düşük |
| B | **Tüm `*.supabase.co` wildcard'ını allow et** (`**.supabase.co`) | En esnek; tüm Supabase projeleri otomatik çalışır | Saldırı yüzeyi büyür (herhangi bir Supabase projesinden gelen URL image optimizer'a girer — tehdit düşük ama sıfır değil) | Düşük |
| C | **Çoklu host listele** (dev, staging, prod explicit) | Görünürlük tam | Her yeni ortam kod değişikliği ister | Düşük |

**Karar:** **Seçenek A** (birincil) + **Seçenek C destek** (fallback hardcoded dev host'u olarak). `next.config.ts`:

```ts
const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname; }
  catch { return undefined; }
})();

const remotePatterns = [
  ...(supabaseHost ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : []),
  // Future: staging/prod için manuel eklemeler buraya
];
```

**Sonuçlar:**
- Kolaylaşır: Yeni ortam açmak için sadece env dosyası değişir; staging/prod ayırt edici kod yok.
- Zorlaşır: Yok; build time env'in doğru set olduğuna bel bağlanır (zaten deploy için şart).
- Yeni borç: `next.config.ts`'nin env okumasının Vercel build'de garantili olduğunu doğrulamak gerekir (Vercel build ortamında `NEXT_PUBLIC_*` zaten mevcut — risk düşük).

**Geri alınabilirlik:** **High** — tek dosya değişikliği.

**İlk uygulama adımları:**
1. `next.config.ts`'yi yukarıdaki gibi env-driven yap.
2. `.env.local.example`'da `NEXT_PUBLIC_SUPABASE_URL`'i zorunlu (required comment) işaretle.
3. Build-time güvenlik: eğer env yoksa build warning (değil error) ver.
4. `CLAUDE.md`'de "multi-env stratejisi" mini-bölümü yaz (ADR-010'a referans).

---

### ADR-006: Test Altyapısını "Zero Config" Başlangıçla Çalışır Kılmak (Vitest + Playwright)

**Durum:** Proposed
**Kapsadığı bulgular:** #6
**Bağlam:** `vitest`, `@vitejs/plugin-react`, `@testing-library/*`, `@playwright/test` paketleri `devDependencies`'de yüklü. Ancak `vitest.config.*`, `playwright.config.*` dosyaları ve `__tests__/` veya `*.test.ts` dosyaları **yok**. `package.json`'da `test`, `test:e2e`, `typecheck` script'i de yok. Bu, "test eklemek istediğimizde engel yok" anlamına gelmiyor — **başlangıç friction'ı var**.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **Minimum viable test config ekle** (bir `vitest.config.ts`, bir `playwright.config.ts`, bir örnek `health.test.ts`, `package.json`'a `test`, `test:e2e`, `typecheck` script'leri) | Builder'lar tek komutla başlar; CI'ye teardown eklenebilir | Config kararları (coverage threshold, happy-dom vs jsdom, v8 vs istanbul) şimdi alınacak | Düşük |
| B | **Testi Phase 2'ye ertele, şimdi sadece typecheck script'i ekle** | Hız | Regression risk devam eder; sonra yapmak daha pahalı | Çok düşük |
| C | **Jest'e geç** (Next.js with-jest örneği yaygın) | Ekosistem yaygınlığı | Vitest zaten yüklü; değişim maliyeti > kazanç | Yüksek |

**Karar:** **Seçenek A** — minimum viable test config.

Sözleşme:
- `vitest.config.ts` + `vitest.setup.ts` — `jsdom` environment; `@testing-library/jest-dom` setup; path alias (`@/*`) tsconfig ile senkron.
- `playwright.config.ts` — `./tests/e2e` dizinini tara; `webServer` ile `npm run build && npm run start` veya `npm run dev`; base URL env-driven.
- `package.json` script'ler:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"test:e2e": "playwright test"`
  - `"typecheck": "tsc --noEmit"`
- İlk testler:
  - Unit: `src/lib/encryption/aes-gcm.test.ts` (encrypt → decrypt roundtrip — saf, external dep yok)
  - Integration (mock): `src/modules/auth/service.test.ts`
  - E2E smoke: `tests/e2e/login.spec.ts` (login flow'unu mock session ile veya test kullanıcısıyla yürüt)

**Sonuçlar:**
- Kolaylaşır: Downstream regression'ı yakalama; CI pipeline'ı eklemek mümkün (ADR-010).
- Zorlaşır: Her yeni feature için test yazma beklentisi doğar (doğru ama disiplin maliyeti).
- Yeni borç: Supabase mock stratejisi gerekir (service-role call'ları için); ilk sürümde yalnızca saf fonksiyonlar test edilir, DB gerektiren testler Phase 2.

**Geri alınabilirlik:** **High** — config dosyaları basit.

**İlk uygulama adımları:**
1. `vitest.config.ts` + `vitest.setup.ts` yaz.
2. `playwright.config.ts` yaz.
3. `package.json` script'lerini ekle.
4. En az 1 unit test (encryption) + 1 e2e smoke test (login) yaz.
5. `CLAUDE.md` "Testing" bölümünü ekle.

---

### ADR-007: E-posta Bildirimlerini Resend Üzerinden Teslim Etmek (Notification Adapter'ı)

**Durum:** Proposed
**Kapsadığı bulgular:** #7
**Bağlam:** `resend` paketi `dependencies`'de. `notifications` tablosu `email_sent` flag'i var. `RESEND_API_KEY` `.env.local.example`'da. Ancak `resend`'i import eden **hiçbir dosya yok**; notification akışı yalnızca in-app `NotificationPoller` üzerinden çalışıyor ve kullanıcıya e-posta hiç gönderilmiyor. Bu bir "eksik feature" değil; `notifications` tablosundaki veriler `email_sent=false` olarak birikiyor.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **Adapter pattern'e bağlı "Email Adapter"** (`src/adapters/email/`) | LLM/STT/TTS ile tutarlı mimari; provider swap kolay (SES, Postmark, vb.) | Biraz fazla abstraction — şimdilik tek provider var | Orta |
| B | **Doğrudan `resend` kullanan `lib/notifications/email.service.ts`** | En az kod | Provider değişirse refactor gerekir | Düşük |
| C | **Supabase Edge Function'a push et, orada send** | Webhook pattern; Next.js runtime hafif kalır | Supabase Edge Functions şu an projede hiç kullanılmıyor (yeni altyapı); deploy/debug ek iş | Yüksek |

**Karar:** **Seçenek A** — Email Adapter. Sebep: Proje zaten adapter pattern'i benimsemiş; tutarlılık değerli. Adapter küçük bir interface (`sendTransactionalEmail(to, subject, html, text)`) etrafında. Bu aynı zamanda test'te no-op adapter koyarak e-posta gönderimini mock etmeyi kolaylaştırır.

Akış:
1. `NotificationService.create(userId, type, payload)` → `notifications` tabloya INSERT.
2. Aynı service opsiyonel olarak `EmailAdapter.sendTransactionalEmail(...)` çağırır (template'e göre).
3. Başarılıysa `notifications.email_sent = true` update.
4. Hata olursa audit log + retry (QStash publish — mevcut queue altyapısı kullanılabilir, ayrı cron gerekmez).

**Sonuçlar:**
- Kolaylaşır: Evaluation completed, weekly challenge assigned, session dropped gibi event'ler için e-posta çıkışı; compliance (KVKK data deletion confirmation) için e-posta.
- Zorlaşır: Template yönetimi (HTML + text) — MVP'de statik string template yeterli; sonraki fazda `react-email` düşünülebilir.
- Yeni borç: E-posta template'lerinin lokal dili (TR) + marka tutarlılığı (logo, renkler) tenant-scoped olmalı mı? (Açık Soru #3)

**Geri alınabilirlik:** **Medium** — adapter kaldırılabilir ama bir kez e-posta gönderilmeye başlandıktan sonra kullanıcı beklentisi yaratır.

**İlk uygulama adımları:**
1. `src/adapters/email/{interface.ts, resend.adapter.ts, index.ts}` oluştur.
2. `src/lib/notifications/notification.service.ts` yaz (DB + email orchestration).
3. `evaluation.engine.ts` ve cron route'larından event üretimini buraya bağla.
4. `RESEND_API_KEY` var mı kontrolü ile graceful degradation (yoksa sadece in-app notification).
5. İlk template: "Değerlendirmen hazır" + "Haftalık görev geldi".

---

### ADR-008: Tek Gerçeklik Kaynağı (Single Source of Truth) Olarak `users.role`; JWT `user_metadata.role`'u Türetilmiş Değer Yap

**Durum:** Proposed
**Kapsadığı bulgular:** #9
**Bağlam:** Yetkilendirme iki kaynaktan okunuyor:
- **Middleware:** JWT `user_metadata.role` (hızlı, session refresh sırasında Supabase cookie'den çekilir).
- **Server actions + `getCurrentUser()`:** `users.role` sütunu (DB truth).

Senkronizasyon garantisi kodda yok. Örnek senaryo: tenant admin bir kullanıcının role'ünü `/tenant/users` üzerinden değiştirir → `users.role` güncellenir → ama kullanıcının JWT'si hâlâ eski role'ü taşır → middleware yanlış rota izni verir. Invite action zaten `user_metadata`'yı elle set ediyor (`bootstrap-users.mjs` ve `inviteUserAction`) ama **rol güncelleme akışı `user_metadata`'yı güncellemiyor** — Gelistime3.md #1'deki "rol güncellenemedi" hatasının kök sebebi bu olabilir (ayrıca RLS policy hatası da olabilir).

Bu hem **güvenlik** hem **veri tutarlılığı** sorunu.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **`users.role` tek gerçeklik; middleware DB'den oku** (service-role ile hızlı sorgu) | Tek kaynak, tutarsızlık imkansız | Her istekte bir DB hit (middleware edge runtime — latency artar); service-role middleware'de risk | Orta-yüksek |
| B | **`users.role` tek gerçeklik + JWT claim'ine "admin API ile" senkron yaz** (rol değişince `supabase.auth.admin.updateUserById({ user_metadata: { role } })`) + RLS helper'lar JWT okumaya devam eder | Performans değişmiyor; tutarlılık güvence altına alınır | Rol değişikliği sonrası kullanıcının session refresh etmesi gerekir; "Force sign-out on role change" politikası lazım | Düşük-orta |
| C | **JWT tek gerçeklik; `users.role` cache yap** | Tek read path (JWT); DB'deki alan tutarsızlığı değil, türetme | Admin API üstünden role değişikliği her seferinde gerekir; DB trigger'dan auth metadata'ya yazmak mümkün değil (Supabase izin vermez) | Orta |

**Karar:** **Seçenek B** — `users.role` tek gerçeklik kaynağı (write path), JWT türetilmiş ama **yazma anında senkron update edilir**. Seçenek A'nın edge-runtime'da DB hit maliyeti sürdürülebilir değil (her page view'da 50ms+). Seçenek C ise DB'deki audit trail'i (role değişikliği `audit_logs`'a yazılır) kırıyor.

Uygulama sözleşmesi:
1. `updateUserRoleAction(userId, newRole)` iki şey yapar: (a) `users.role = newRole` UPDATE + (b) `supabase.auth.admin.updateUserById(userId, { user_metadata: { role: newRole } })` (service-role ile).
2. Başarıysa `audit_logs`'a yaz.
3. **Kullanıcı bir sonraki istekte yeni JWT alır** (Supabase session refresh). Ama şu anki aktif session eski JWT ile devam eder. Sert bir kesim için: admin API `signOut(userId)` ile force logout çağrılır.
4. Middleware'in JWT okuma davranışı **değişmez** — sadece yazma tarafı disiplinli hale gelir.

Helper: `src/lib/auth/role-sync.ts` — `syncUserRoleToJwt(userId, role)` fonksiyonu tüm rol yazma path'lerinin kullandığı ortak nokta.

**Sonuçlar:**
- Kolaylaşır: Rol değişikliği öngörülebilir; admin UI güvenilir; middleware hızlı.
- Zorlaşır: Rol yazan her yeni action bu helper'ı çağırmayı unutmamalı (lint/test ile yakala).
- Yeni borç: `users.tenant_id` için de aynı desen gerekebilir (tenant değişikliği nadir ama mümkün).

**Geri alınabilirlik:** **Medium** — JWT metadata yazma yanlış giderse (örn. invalid key), rollback için user_metadata elle silmek gerekir; şema değişmiyor.

**İlk uygulama adımları:**
1. `src/lib/auth/role-sync.ts` helper'ı yaz.
2. `user.actions.ts`'deki `updateUserRoleAction` ve `inviteUserAction`'ı bu helper'a çevir.
3. `bootstrap-users.mjs` script'ini aynı sözleşmeye uyumlu hale getir.
4. Role değişikliği sonrası force sign-out opsiyonu ekle (başta UI'da checkbox olarak).
5. Unit test: `role-sync` helper'ı mock Supabase admin API ile test et.

---

### ADR-009: Supabase Schema Reproducibility — "Clean Install" Migration Paketi

**Durum:** Proposed
**Kapsadığı bulgular:** #2 (migration tarafı), #8
**Bağlam:** Mevcut 30 migration'ın temiz bir Supabase projesinde sırayla uygulandığında çalışıp çalışmadığı **test edilmemiş**. Geliştirici, `Gelistime2.md` ve `Gelistime3.md`'de gördüğümüz üzere migration'ları manuel olarak Supabase SQL Editor'da çalıştırıyor — bu akış hata-yatkın ve "aynı DB'yi iki ortamda yeniden üretme" garantisi yok. ADR-002 dual-column sorununu çözer; bu ADR ise **migration sırası + idempotency + reproducibility** disiplini kurar.

**Seçenekler:**

| # | Seçenek | Artı | Eksi | Maliyet |
|---|---|---|---|---|
| A | **Mevcut 30 migration'ı tek bir "baseline" migration'a konsolide et** (yeni bir `20260423_000_baseline.sql`) | Yeni ortam için tek dosya; hızlı setup | Geçmiş tamamen kaybolur; "reset prod" riskli; bir kez yapılırsa geriye gitmek zor | Yüksek |
| B | **Mevcut migration'ları olduğu gibi bırak, her yeni migration'da idempotency + timestamp disiplini zorunlu** (CI'de linter) | Evolusyon korunur; minimum iş | Yeni Supabase'e kurmak hâlâ 30 dosya sırasıyla çalıştırma gerektirir | Düşük |
| C | **Baseline snapshot + forward migrations** — 20260423 öncesi her şey baseline'da dondurulur (`pg_dump` + manuel düzenleme); sonrası sadece forward | Hız + tarih | Baseline oluşturma bir defalık ama ciddi iş | Yüksek |

**Karar:** **Seçenek B** — pragmatik seçim. Bu proje henüz prod'a çıkmadı; prod'a çıktıktan sonra Seçenek C (baseline) değer kazanır. Şimdi:
1. **Migration naming:** Bu noktadan sonra yalnızca `YYYYMMDDHHMMSS_NNN_short_name.sql` formatı (ADR-002 ile uyumlu).
2. **Idempotency:** Her yeni migration **idempotent** olmak zorunda (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS ... CREATE POLICY ...`, `CREATE OR REPLACE FUNCTION`, vb.). AGENTS.md zaten bunu yazıyor — ADR-level'a yükseltiyoruz.
3. **Migration sırası testi:** `supabase/migrations/` dizinini alfabetik sırada uygula → bir staging Supabase projesinde test et. Runbook adımı olarak zorunlu.
4. **Clean-install doğrulama script'i:** `scripts/verify-migrations.mjs` — boş bir Supabase projesine tüm migration'ları uygula, beklenen tablo/enum/policy sayılarını assert et. CI'ye eklenir (ADR-010).

**Sonuçlar:**
- Kolaylaşır: Yeni ortam kurulumu script'e indirgenir; regression yakalanır.
- Zorlaşır: Her migration yazarken idempotency disipline edilmeli.
- Yeni borç: Baseline snapshot kararı prod sonrası gündeme alınacak (açık soru).

**Geri alınabilirlik:** **High** — yaptıklarımız esasında disiplin; geriye kolay dönülür.

**İlk uygulama adımları:**
1. ADR-002'deki yeni migration'ı timestamp'li naming ile yaz.
2. `scripts/verify-migrations.mjs` iskeletini yaz (ilk aşamada sadece dosya sıralamasını print et).
3. Mevcut 30 migration'ı boş bir staging projesinde manuel uygula; hata varsa idempotency düzeltmesi olan yeni migration ekle (eski dosyaları düzeltme — history immutable).
4. `AGENTS.md`'de migration naming kuralını yeniden vurgula.

---

### ADR-010: Auth Method — Email OTP (Passwordless)

**Durum:** Accepted (2026-04-24)

**Bağlam:**
MVP davet akışında şifre üretme → iletme → zorunlu değiştirme zinciri 3 ayrı akış gerektiriyor (Akış 3 tekli davet, Akış 2 toplu yükleme, Akış 4 ilk giriş şifre değiştirme). Bu zincir; geçici şifrenin güvenli iletilmesi, "Beni Hatırla" olmayan MVP'de her oturumda şifre girilmesi ve ilk giriş zorlaması gibi karmaşıklıklar yaratıyor.

**Karar:**
Şifre tabanlı auth → E-posta OTP (passwordless) geçişi. Kullanıcı giriş yapmak istediğinde e-posta adresini girer, 6 haneli tek kullanımlık kod mail olarak gelir, kod ekrana girilir.

**Teknik Detaylar:**
- Kod uzunluğu: 6 haneli (Supabase default — değiştirilmeyecek)
- Geçerlilik süresi: 24 saat
- Yanlış deneme limiti: 5 yanlış giriş → kod geçersiz, yeni kod istenebilir
- "Beni Hatırla": Yok (MVP kapsam dışı)
- E-posta gönderimi: Resend SMTP → Supabase Dashboard Authentication → SMTP Settings. Supabase dahili mail limiti (≈3/saat) devre dışı kalır.
- Supabase API'leri: `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })` + `supabase.auth.verifyOtp({ email, token, type: 'email' })`
- Rate limiting: Upstash Redis (zaten yüklü) — OTP endpoint spam koruması
- Test kolaylığı: `supabase.auth.admin.generateLink()` ile token direkt çekilir (mail beklemeden dev/test)

**Sonuçlar:**
- Olumlu: Akış 4 (First-Login Password Change) tamamen ortadan kalkar → efor azalır
- Olumlu: Akış 2 ve 3'te geçici şifre üretme/iletme/gösterme adımları kalkar → akışlar sadeleşir
- Olumlu: Şifre yönetim yükü sıfırlanır (unutma, sıfırlama, zayıf şifre)
- Dikkat: E-posta deliverability kritik altyapı olur (DKIM/SPF/DMARC + Resend zorunlu)
- Dikkat: Her giriş e-posta erişimi gerektiriyor (mail provider çökerse giriş yapılamaz)

**Etkilenen Kararlar:**
- ADR-007 (Resend notification adapter): Criticality P0'a yükseltildi — OTP mail gönderimi için zorunlu prereq
- Akış 4 (First-Login Password Change): Geçersiz kıldı — roadmap'te üstü çizili bırakıldı
- Akış 2 (Bulk Upload): Batch temp password adımı kaldırıldı
- Akış 3 (Invite-Only Onboarding): Temp password adımı kaldırıldı

---

## 4. Cross-Cutting Mimari Prensipler

Bu projeye özel 7 prensip. Her yeni PR bu listeye karşı gözden geçirilir.

### P1. Tek Gerçeklik Kaynağı (Single Source of Truth)
Bir veri birden fazla yerde yaşıyorsa, **yazma path'i tek olmalı**; okuma path'leri türetilebilir. Uygulama: `users.role` (ADR-008); ileride `tenant_id` için de aynı desen.
**İlgili ADR'lar:** ADR-008.

### P2. Environment-Aware Config
Hiçbir host, URL, tenant ID, feature flag veya model isim **kod içinde hardcoded olmaz**. Env var veya config dosyasından okunur.
**İlgili ADR'lar:** ADR-001, ADR-005, ADR-004.

### P3. Migration Idempotency + Timestamp Naming
Her migration idempotent (`IF EXISTS`, `IF NOT EXISTS`) olmalı ve `YYYYMMDDHHMMSS_NNN_name.sql` formatını kullanmalı. Plain-numeric naming legacy (olduğu gibi kalır, yenisi yasak).
**İlgili ADR'lar:** ADR-002, ADR-009.

### P4. Feature-Flag'li Teslim
Yarım özellik production'a **flag kapalı** halde gider; flag açılması bir deploy değil env değişikliği olur. Placeholder sayfalar nav'dan gizlenir.
**İlgili ADR'lar:** ADR-004.

### P5. Adapter Pattern for External Services
LLM, STT, TTS, Email, Storage gibi **dış servisler** interface arkasına alınır; provider swap kodun geri kalanını etkilemez.
**İlgili ADR'lar:** ADR-007 (email); mevcut `src/adapters/` zaten bu prensibi uyguluyor. **Tekilleştirme borcu:** `src/lib/adapters/` → `src/adapters/` konsolidasyonu (bu mimari karar değil, refactor görevi; ayrı bir ADR gerektirmez).

### P6. Service-Role Minimization
`createServiceRoleClient()` yalnızca (a) RLS'in ifade edemediği business-rule'ların olduğu yerlerde, (b) cron/webhook handler'larda, (c) admin-API (auth metadata yazma) çağrılarında kullanılır. Her yeni service-role çağrısı code review'da **gerekçelendirilmeli**.
**İlgili ADR'lar:** ADR-008, ADR-007.

### P7. Test'te "Graceful Degradation"
Bir dış servis (OpenAI, Resend, QStash) env'i yoksa sistem **crash etmez**; log yazar ve ilgili feature'ı kapatır. Örnek: `RESEND_API_KEY` yoksa e-posta gönderimi atlanır, in-app notification yine oluşturulur. Health endpoint bu durumu raporlar.
**İlgili ADR'lar:** ADR-007.

---

## 5. Downstream Agent'lara Devir

### 5.1 Workflow Architect için

**Mimariye doğrudan bağımlı akışlar (öncelikli haritalama sırası):**
1. **Auth & Role Resolution** (login → consent → redirect → role gate). ADR-008 bu akışın omurgasını değiştiriyor.
2. **Session Lifecycle** (create → activate → chat → end → evaluate). Mimari açıdan stabil, ama ADR-001 (QStash env'ler) evaluation loop'unu bloke ediyor.
3. **Notification + Email** (ADR-007 öncesi akış **eksik**). Bu akış baştan tasarlanacak.
4. **Onboarding (invite → first login)** — Sign-up yok, invite tabanlı (`inviteUserAction`). Akış kısmen çalışıyor ama role sync (ADR-008) bozuluyor.
5. **Gamification (badge/challenge yazma → user'a dağıtım)** — ADR-002 sonrası test edilecek.

**Hangi ADR hangi akışı etkiliyor (tablo):**

| Akış | ADR-001 | ADR-002 | ADR-003 | ADR-004 | ADR-005 | ADR-006 | ADR-007 | ADR-008 | ADR-009 |
|---|---|---|---|---|---|---|---|---|---|
| Auth & Role | — | — | — | — | — | ✓ | — | **✓✓** | — |
| Session Lifecycle | **✓✓** | — | — | — | — | ✓ | — | — | — |
| Evaluation Queue | **✓✓** | — | — | — | — | ✓ | ✓ | — | — |
| Notifications | ✓ | — | — | ✓ | — | — | **✓✓** | — | — |
| Gamification | — | **✓✓** | — | ✓ | — | ✓ | ✓ | — | ✓ |
| Manager/Admin UI | — | — | **✓** | **✓✓** | — | — | — | ✓ | — |
| Image/Storage | — | — | — | — | **✓✓** | — | — | — | ✓ |
| Migration Pipeline | — | ✓ | — | — | — | — | — | — | **✓✓** |

**Henüz mimari kararı bekleyen akışlar** (Açık Sorular bölümüne referansla):
- **Voice mode uçtan uca** — STT/TTS adapter'ları ayrı klasörde; VoiceSessionClient'ın uçtan uca testi yapılmamış. Workflow Architect bu akışı haritalayınca, "voice mode ADR" gerekebilir (şu an erken).
- **Sign-up (self-serve)** — Açık Soru #4'e bağlı. Karar gelene kadar workflow taslağı yazılmasın.

---

### 5.2 Project Shepherd / Senior PM için

**9 bulgu ve ADR eşleşmesi → önceliklendirme:**

| ADR | Bulgu # | Öncelik | Gerekçe |
|---|---|---|---|
| ADR-001 | #1 | **P0** | Deploy blocker; QStash env yoksa evaluation çalışmaz — ürünün çekirdek akışı ölü |
| ADR-002 | #2, #8 | **P0** | Gamification CRUD şu an kırık; kullanıcı testi bunu her sürümde raporluyor (Gelistime*.md) |
| ADR-008 | #9 | **P0** | Güvenlik + "rol güncellenemedi" bug'ının kök sebebi — kullanıcı bunu şikayet etmiş |
| ADR-005 | #5 | **P1** | Tek env'de problem değil; multi-env'e geçince zorunlu |
| ADR-004 | #4 | **P1** | UX kırık (sidebar'da item tıklayınca boş sayfa); kullanıcı notları bunu rapor ediyor |
| ADR-003 | #3 | **P1** | Route collision riski; klasör artıkları builder'ları yanıltır |
| ADR-007 | #7 | **P2** | Feature eksikliği, ama in-app notification çalışıyor — kullanıcı deneyimi kısmen yeterli |
| ADR-009 | #2, #8 | **P2** | Prensip kararı; prod'a çıkmadan önceki son fazda kritikleşir |
| ADR-006 | #6 | **P2** | Regression riski ama MVP'yi engelemiyor |

**Bağımlılık zinciri:**
- **ADR-002 → ADR-009:** Migration unification yapılınca, clean-install doğrulama (ADR-009) script'i anlamlı hale gelir.
- **ADR-001 → ADR-007:** QStash env'leri düzeldikten sonra email gönderimi QStash retry'ına bağlanabilir.
- **ADR-008 → ADR-003:** Rol sync düzeltilmeden boş klasör temizliği yapılırsa, silme sırasında yetki hataları teşhis karıştırabilir (sıra önemli değil aslında, ama ADR-008 yüksek öncelikli).
- **ADR-005 → DevOps (ADR-010 gibi bir gelecek ADR):** Multi-env Supabase kararı (Açık Soru #1) alınmadan ADR-005 tam değer üretmez.

**Faz önerisi:**

#### Phase 0 — Stabilization (2-3 iş günü)
**Hedef:** Mevcut kullanıcı deneyimindeki kanayan yaraları kapat; deploy-blockable maddeleri çöz.
**Kapsam:** ADR-001, ADR-002, ADR-008.
**Çıkış kriterleri:**
- `.env.local.example` kod ile %100 uyumlu.
- Tenant admin yeni rozet oluşturabiliyor, hata yok.
- Rol değiştirince middleware doğru karar veriyor (manuel test).
- `/api/health` endpoint'i tüm env'lerin varlığını doğruluyor (set/unset).

#### Phase 1 — Deploy-Ready MVP (3-5 iş günü)
**Hedef:** Production'a güvenle deploy edilebilir halde olmak.
**Kapsam:** ADR-003, ADR-004, ADR-005.
**Çıkış kriterleri:**
- `npm run build` temiz; route collision yok.
- Placeholder sayfalar nav'dan gizli (flag kapalı); 5 yüzey çağırıldığında 404 döner.
- `next.config.ts` `NEXT_PUBLIC_SUPABASE_URL`'den host çekiyor.
- Staging env'inde (varsa) avatar image'ları düzgün render ediliyor.

#### Phase 2 — Feature Completion (2-3 hafta)
**Hedef:** MVP'nin eksik feature'larını tamamla.
**Kapsam:** ADR-007 (email), ADR-004 (feature-flag'lerle açılan sayfaların doldurulması — progress, notifications, manager/team, manager/reports).
**Çıkış kriterleri:**
- "Evaluation hazır" e-postası tetikleniyor (opt-in).
- 4 placeholder sayfası gerçek içerik ile hayata geçer; flag production'da açılır.

#### Phase 3 — Production Hardening (1-2 hafta)
**Hedef:** Operasyonel güven kazan.
**Kapsam:** ADR-006 (test), ADR-009 (migration reproducibility), observability genişletmesi.
**Çıkış kriterleri:**
- `npm run test` en az 10 unit + 3 e2e ile yeşil.
- CI pipeline: lint + typecheck + test + build aşamaları.
- Boş Supabase projesine tüm migration'lar `verify-migrations.mjs` ile temiz uygulanıyor.

---

### 5.3 DevOps Automator için

**Deploy blocker ADR'ları:**
1. **ADR-001** — QStash env isimleri düzelmeden prod deploy'u evaluation kırar.
2. **ADR-002** — Badge/challenge yazma şu an 500 döndürüyor; gamification feature'ı ölü. Yeni migration prod'a uygulanmadan deploy edilmemeli.
3. **ADR-005** — `next.config.ts` hardcoded kaldığı sürece staging/prod için ayrı Supabase projesi açılamaz.
4. **ADR-008** — Rol senkronizasyonu düzelmeden prod'a yeni kullanıcı kabul etmek güvenlik açığı.

**Environment Strategy (mimari gereksinimler):**
- **3 env:** `development` (yerel + ortak dev Supabase), `staging` (deploy'un son sınavı), `production`.
- Her env için farklı Supabase URL + farklı QStash hesabı (veya aynı QStash'te farklı token/signing key pair'i).
- `APP_ENV` env var'ı (`.env.local.example`'da zaten var) kullanılır; `/api/health` bu değeri raporlar.

**Supabase proje yapısı önerisi (trade-off ile):**

| Opsiyon | Artı | Eksi |
|---|---|---|
| **Tek Supabase proje, staging/prod aynı DB** | Maliyet düşük | Migration test edilemez; prod data'ya test yazımı riski |
| **İki ayrı Supabase proje (staging + prod)** | Clean isolation; migration'ı önce staging'de test | İki proje maliyeti + iki kere env set + iki kere secret yönetimi |
| **Supabase Branching** (CLI feature) | Git branch'e benzer şekilde DB branch | Supabase branching hâlâ preview/gated; risk |

**Öneri:** **İki ayrı Supabase projesi** (staging + prod). Dev lokal ortamda ortak dev projesini paylaşabilir (maliyet). Branching'i sadece büyük migration deneylerinde kullan. **Bu karar kullanıcı onayı bekliyor (Açık Soru #1).**

**CI/CD Pipeline için mimari kısıtlar:**
- **Migration order:** CI'de migration sırasını doğrulayan bir `verify-migrations` adımı (ADR-009).
- **RLS test:** RLS policy regression yakalamak için en az birkaç e2e testi gerekir (ADR-006'nın Phase 3 çıkışı).
- **Secret rotation:** Encryption key (`ENCRYPTION_KEY`) rotate edilirse eski `prompt_logs` okunamaz hale gelir — rotate stratejisi gerektiğinde ayrı ADR yazılmalı.
- **Build-time env'ler:** `NEXT_PUBLIC_SUPABASE_URL` build time'da set olmalı (ADR-005'in `next.config.ts` dinamik okuması nedeniyle).
- **QStash schedule:** Cron rotaları (`session-timeout`, `assign-weekly-challenges`) QStash dashboard'unda manuel schedule edilir — bu bir infra script değildir, DevOps runbook'unda adım olmalı.

---

### 5.4 Builder / Implementation ekibi için

**ADR'ları uygulama sırası (kısa tekrar):**
1. ADR-001 (env rename — dakika cinsinden)
2. ADR-002 (yeni migration + action güncellemesi — 1-2 saat)
3. ADR-008 (role-sync helper + tüm role write path'lerine bağla — yarım gün)
4. ADR-003 (klasör temizliği — yarım saat)
5. ADR-005 (next.config env-driven — 15 dk)
6. ADR-004 (feature flag infra + nav update — 2-3 saat)
7. ADR-007 (email adapter — 1 gün)
8. ADR-006 (test config — 2 saat config + örnek testler)
9. ADR-009 (migration verify script — 2-3 saat)

**Kaçınılması gereken yaygın yanlış anlamalar:**

- **`src/app/\(dashboard\)/` silinirken shell escape'e dikkat:** Klasör adı gerçekten `\(dashboard\)` (ters slash karakterleri içeriyor). `git rm -r "src/app/\(dashboard\)"` — **çift tırnak** veya backslash escape kullanın; **yeniden yaratılmasın**.
- **`src/app/(admin)/` ve `src/app/(manager)/` parantezli route grubunu silmek yerine** sidecar niyet dokümantasyonu bırakmak istiyorsanız: Next.js route grup adına parantez **şart**; grubu silmek istiyorsanız içindeki her şey silinir.
- **`code` vs `badge_code`:** Yeni migration'da `DROP COLUMN badge_code` yazarken **`IF EXISTS`** kullanın — çifte çalıştırma güvenliği.
- **Rol sync helper'ı atlamamak:** Her yeni `users.role` UPDATE **mutlaka** `role-sync.ts` helper'ından geçmeli; doğrudan SQL update yapmak yetkilendirme drift'i yaratır.
- **`next.config.ts` env okuma:** Next.js build'de env var'lar **build time'da** inline edilir; runtime'da process.env okuma çoğu `NEXT_PUBLIC_*` için değil server-side için geçerlidir. `next.config.ts` build time'da çalışır — doğru.
- **Placeholder sayfayı silmek yerine** `notFound()` döndür: Böylece flag açıldığında aynı dosyaya içerik eklenir; rota yeniden oluşturulmaz.

---

## 6. Açık Sorular (Kullanıcıya)

Project Shepherd yol haritasını kesinleştirmeden önce aşağıdaki sorulara yanıt gereklidir.

1. **Supabase proje yapısı:** Tek proje mi kalsın, yoksa staging + prod için iki ayrı Supabase projesi mi açalım? (ADR-005 + DevOps planı bu yanıtı bekliyor.)
2. **QStash Webhook Erişim:** QStash cron webhook'ları (`/api/cron/session-timeout`, `/api/cron/assign-weekly-challenges`) şu an **public endpoint** — imza doğrulama ile korunuyor. Ekstra koruma (IP allowlist, Supabase Edge Function arkasına taşıma) istiyor musunuz, yoksa imza yeterli mi?
3. **Multi-tenant Izolasyonu:** Şu an row-level (`tenant_id` sütunu + RLS). Enterprise müşteriler için schema-level (her tenant ayrı Postgres schema) veya dedicated Supabase project opsiyonları gelecekte planlanacak mı, yoksa row-level kesin mi? Bu kararı şimdi almanız gerekmiyor ama **planda bir yerde var mı** bilmek, persona/scenario tablolarındaki `tenant_id IS NULL` global pattern'ini nasıl geliştireceğimizi etkiler.
4. **Sign-up akışı:** MVP'de **self-serve sign-up** olacak mı (public register page), yoksa tamamen invite-based mi kalacak? (Workflow Architect bu karara göre onboarding akışını haritalayacak.)
5. **Placeholder sayfaların MVP'ye dahil olması:** `/dashboard/progress`, `/dashboard/notifications`, `/manager/team`, `/manager/reports` MVP'de **görünmeyecek mi** (flag kapalı), yoksa en az basit bir versiyon MVP'ye girecek mi? (ADR-004 şu an "flag kapalı" öneriyor.)
6. **Resend / E-posta v1:** İlk release'te hangi e-postalar olmalı? Öneri: "Davet alındı" + "Değerlendirme hazır" — yeterli mi, yoksa haftalık özet gibi daha fazlası mı lazım?
7. **`Gelistime*.md` bug listesinin güncel durumu:** Gelistime4.md bazılarını kapatmış; geriye hangi maddeler hâlâ açık? (Bu bilgi Phase 0 scope'unu netleştirir — özellikle Gelistime2.md ve Gelistime3.md'deki "rol güncellenemedi", "durum güncellenemedi" hataları ADR-008 kapsamında mı yoksa ayrı bug mı?)
8. **Voice mode önceliği:** Voice akışı MVP'nin parçası mı, yoksa Phase 2'ye mi kaydedilsin? ElevenLabs API key boş, adapter ayrı klasörde — "Phase 2" daha gerçekçi görünüyor ama teyit istiyoruz.
9. **Billing / Subscription:** SaaS olarak billing modeli planı (Stripe / iyzico / manuel fatura)? Eğer planda varsa, `tenants` tablosuna `subscription_tier`, `billing_account_id` gibi alanlar Phase 2 öncesinde eklenmeli.
10. **`src/adapters/` ile `src/lib/adapters/` konsolidasyonu:** Tek klasöre (`src/adapters/`) taşıma + import path değişikliği — önemli ama küçük bir refactor. Phase 1'de mi, yoksa Phase 3 hardening'de mi?
11. **`/admin/system` rotasının geleceği:** Middleware'de koruyor ama sayfa yok. Gerçekten bir "sistem" sayfası planlandı mı, yoksa middleware'den silelim mi?
12. **`src/modules/*` iskeletinin kaderi:** 10 boş modül klasörü — refactor hedefi olarak korunacak mı, yoksa şimdilik silinip sonra ihtiyaca göre yeniden açılacak mı?

---

## 7. İncelenen Kaynaklar

**Primary input:**
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/Gelistirme23Nisan/system_analiz_20260423.md` (tamamı, 683 satır)

**Sanity-check kod okumaları:**
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/middleware.ts` (rol gate teyidi)
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/next.config.ts` (hardcoded Supabase host teyidi)
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/src/lib/supabase/` dizin listesi (client.ts, middleware.ts, server.ts — analiz ile tutarlı)
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/supabase/migrations/` dizin listesi (dual naming regime + çift `022` dosyası teyidi)

**Proje dokümantasyonu:**
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/CLAUDE.md`
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/AGENTS.md`
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/Gelistime.md`
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/Gelistime2.md`
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/Gelistime3.md`
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/Gelistime4.md` (en güncel "yapılan değişiklikler" logu)

**Kasten incelenmemiş (onboarding belgesi yeterli kabul edildi):**
- `src/` altındaki tüm dosyalar (onboarding döküman üzerinden güvenildi).
- Migration dosyalarının tam SQL içerikleri (onboarding özeti yeterli).

---

> Bu belgedeki ADR'lar `Proposed` durumundadır. Project Shepherd tarafından kullanıcı ile önceliklendirme + Açık Sorular (§6) cevaplandıktan sonra `Accepted`'e çekilip implementation adımı başlayacaktır.

---

## Güncelleme — 2026-04-23 Akşamı

### §6 Açık Soruların Durumu

Kullanıcı bu belgeyi inceledi ve bazı sorulara yanıt verdi:

| Açık Soru | Durum | Karar |
|---|---|---|
| **Soru #1** — Staging + prod Supabase projesi ayrımı | ✅ Cevaplandı | **İki ayrı Supabase projesi** (staging + prod) + yerel `supabase start`. Pro + branching, ilk paralı müşteri geliri oluştuktan sonra değerlendirilecek. |
| **Soru #4** — Self-serve sign-up | ✅ Cevaplandı | **Invite-only** yeterli MVP için. Ek gereksinim: **CSV/XLSX ile bulk user upload** (kolonlar: `Ad Soyad`, `E-posta`, `Rol`, `Departman`). |
| **Soru #7** — Gelistime*.md bug listesinin güncel durumu | ✅ Cevaplandı | `Gelistime4Kontrol.md`'e göre: Item #1 (badge CRUD) hâlâ bozuk → ADR-002 Phase 0 P0. Item #2 (profil) **Tenant Admin'de** düzeldi ancak **standart `user` rolünde hâlâ bozuk** — yeni Phase 0 P0 bug'ı. Item #3, #4 kabul. |
| **Soru #2, #3, #5, #6, #8, #9, #10** | Açık | Project Shepherd veya builder sırasında ele alınacak. |

### Workflow Architect'in Üç Soruya Yanıtları

Workflow Architect belgesi (`akis_haritasi_20260423.md`) kullanıcıya üç ek soru sordu, yanıtlar:
- **Geçici şifre formatı:** Batch başına sabit şifre (admin belirler veya sistem bir kez gösterir)
- **Rol değişikliği sonrası davranış:** Force sign-out (aktif oturumu kapat)
- **Evaluation kalıcı başarısızlık UI:** Timeout sonrası "Yeniden dene" butonu

Bu yanıtlar akış belgesinin "Güncelleme — 2026-04-23 Akşamı" bölümünde detaylandırıldı.

### Yeni Phase 0 P0 Bug'ı

**Bug: Standart `user` rolünde profil fotoğrafı + input güncelleme çalışmıyor.**
- `Gelistime4Kontrol.md` Item #2 sadece **Tenant Admin** için test edildi, düzeldiği rapor edildi.
- 2026-04-23 akşamında kullanıcı `user` rolünde denediğinde aynı sayfa hâlâ bozuk.
- Muhtemel kök sebep: RLS policy'si `tenant_admin`'e göre yazılmış, `user` self-update senaryosunu dışlamış.
- ADR-008 (role single source) ile dolaylı ilgili; ana problem RLS dizimi, rol dualism değil.
- **Phase 0 P0 scope'a ek madde.** Yeni bir ADR değil; builder düzeyinde bir migration/policy düzeltmesi.

### ADR Durum Güncellemesi

- **ADR-005** (multi-env config): Soru #1 cevaplandı → "iki ayrı Supabase projesi" olarak netleşti. Status: `Proposed` → **`Accepted`**.
- Diğer ADR'lar (001, 002, 003, 004, 006, 007, 008, 009) hâlâ `Proposed`. Project Shepherd ile faz planlama sırasında toplu `Accepted`'e çekilmesi önerilir (bir kısmı builder sırasında revize edilebilir, ama karar yönleri sabit kalacak).

### Deferred Mimari Scope — AI Roleplay Çekirdek Akışı ✅ TAMAMLANDI (2026-04-24)

2026-04-24 kullanıcı spec session'ında 5 yeni ADR (ADR-011..ADR-015) eklenerek bu scope kapatıldı.

---

## Güncelleme — 2026-04-24: Phase 2 AI Roleplay ADR'ları

---

### ADR-011 — Voice-Only Mode: Text Modunu Kaldır

**Durum:** Accepted (2026-04-24 — user onayı)

**Bağlam:**
- Mevcut kod hem `text` hem `voice` session mode'u destekliyor.
- Kullanıcının ürün vizyonu: MVP ve MVP sonrası sadece ses tabanlı seanslar — metin modu "gerçek koçluk deneyimini" vermiyor.
- Voice-only olunca: kullanıcı sesinin duyguları, tonlaması, tereddütleri evaluation'a girer → daha zengin değerlendirme.

**Karar:**
- `sessions.session_mode` enum'undan `text` değeri kaldırılacak.
- `SessionClient` (text) silinecek; tüm seanslar `VoiceSessionClient` üzerinden ilerleyecek.
- `NewSessionStepper`'dan mode seçim adımı çıkarılacak.

**Sonuçlar:**
- **Artı:** Tek kod yolu → bakım yükü azalır. UX daha net. "Koçluk" değeri daha güçlü.
- **Eksi:** Mikrofon kullanamayan kullanıcı (engelli, mikrofon yok, sessiz ortam) hiç seans yapamaz. Phase 3+ accessibility item'ında "push-to-type fallback" değerlendirilecek.
- **Eksi:** Dev ve QA maliyeti — voice mode test etmek text'ten daha zor. CI'ya voice test eklemek Phase 3+.

**Alternatifler düşünüldü:**
- **(a)** İki modu korumak — maliyet/karmaşıklık yüksek, ürün vizyonu tek yön.
- **(b)** Text-only geçici olarak (voice Phase 2 sonrası) — voice pipeline zaten %80 çalışıyor; gereksiz geri adım.

---

### ADR-012 — Debrief Architecture: Farklı Voice + Paralel Evaluation

**Durum:** Accepted (2026-04-24 — user onayı)

**Bağlam:**
- Seans biter bitmez "rapor sayfasına geç" UX'i kuru ve geçiş sert. Kullanıcı seans boyunca gerginlik yaşamış olabilir (özellikle zor senaryolarda).
- Evaluation LLM çağrısı 10-15 sn sürüyor; bu süre kullanıcı için boş bekleme.
- Kullanıcıdan **ürün geliştirme için feedback** alma fırsatı kaçırılıyor.

**Karar:**
- Yeni bir "debrief" katmanı: seans biter bitmez **farklı bir koç karakteri** (farklı ElevenLabs voice ID — tok, güven veren, warm ton) devreye girer.
- 1-2 dk AI-driven samimi sohbet:
  - "Nasıl geçti?"
  - "Persona beklentini karşıladı mı?"
  - "Senaryo gerçekçi miydi?"
  - "Nasıl geliştirebiliriz?"
- **Paralel olarak** arka planda evaluation çalışır (QStash 5 sn delay sonrası).
- Debrief bittiğinde evaluation hazırsa rapor sayfası açılır; değilse "Hazırlıyorum" mesajı + polling.
- Debrief transcript'i **evaluation'a girmez** (D3 kararı — amacı feedback toplamak).
- Super admin "Kullanıcı Geri Bildirimleri" sayfasından debrief mesajları okur → persona/senaryo prompt iyileştirme öneri sistemi.

**Yeni DB state'ler:**
- `sessions.status`: `debrief_active`, `debrief_completed` eklendi.

**Yeni tablolar:**
- `debrief_messages` — debrief transcript'i (session_messages'tan ayrı).
- `persona_prompt_feedback` — super_admin notes.

**Yeni env:**
- `ELEVENLABS_DEBRIEF_COACH_VOICE_ID`

**Sonuçlar:**
- **Artı:** Kullanıcı bekleme süresinde rahat sohbet → UX kırılganlığı düşer. Ürün feedback kanalı açılır.
- **Artı:** Karakter geçişi ("ağır senaryo personası" → "sıcak koç") duygusal decompression sağlar.
- **Eksi:** Ek TTS maliyeti (her seansa +30 sn ses). Ek LLM maliyeti (debrief ayrı conversation).
- **Eksi:** 2 TTS voice yönetimi (persona voice + debrief coach voice).

**Alternatifler düşünüldü:**
- **(a)** Doğrudan rapor sayfasına geç — UX zayıf.
- **(b)** Aynı persona ile kapanış konuşması — karakter çakışması (sert senaryo persona → yumuşak feedback mantıksız).
- **(c)** Text-based post-session survey — voice-only ürünle çelişki.

---

### ADR-013 — Transcript Summarization Strategy (Rubric-Aware)

**Durum:** Accepted (2026-04-24 — user onayı)

**Bağlam:**
- Mevcut chat API her turda **son 40 mesajı** LLM'e gönderiyor.
- 40 mesaj × ortalama 100 token = 4000 token/turn × 20 turn = 80k token/seans — hem maliyet hem latency yüksek.
- Uzun seanslarda context window limit'e yaklaşıyor.

**Karar:**
- Her **5 mesajda** (5, 10, 15, ...) QStash ile summarize job tetiklenir.
- Summarize LLM prompt'u **rubric-aware**:
  - Koçun sorduğu güçlü sorular
  - Yansıtmalar / özetler
  - Danışanın duygu/direnç ifadeleri
  - Anlaşma/aksiyon/taahhüt ifadeleri
- Output JSON: `{summary: string, rubric_signals: {dimension_code: [evidence]}}`
- Chat API artık gönderiyor: **kümülatif özet(ler) + son 5 ham mesaj**.
- Özet içeriği AES-GCM şifreli (`session_summaries.encrypted_content`).
- Evaluation engine transcript'e ek olarak `rubric_signals`'i de okur → doğru boyutlara doğru kanıt eşleşir.

**Neden 5 mesaj?** C2 kararı ile "kalite korunacak, ama 10 çok fazla 5 makul" sınırı çizildi. Deneyle ayarlanabilir.

**Neden aynı model?** C1+C3 kararı — kalite kaybını önleme. Cheap model (gpt-4o-mini) özetlemede rubric signals'i kaçırırsa evaluation yanılır. Maliyet optimizasyonu Phase 3+'ta model A/B testi ile değerlendirilir.

**Sonuçlar:**
- **Artı:** Chat API call başına ~70% token tasarrufu (4000 → 1250).
- **Artı:** Rubric-aware özet → evaluation kalitesi korunur veya artar.
- **Artı:** Uzun seans desteği (60+ mesaj).
- **Eksi:** Her 5 mesajda ek LLM çağrısı (summarize) — ayrı maliyet kalemi.
- **Eksi:** QStash job fail olursa özet üretilmez, fallback ham mesajlara düşer.

**Alternatifler düşünüldü:**
- **(a)** Sliding window (son 20 mesaj) — basit ama long-range context kaybeder.
- **(b)** Her mesajda vector embedding + retrieval — çok büyük over-engineering MVP için.
- **(c)** GPT-4o-mini summary — kalite riski kabul edilmedi (C1).

---

### ADR-014 — Persona Voice ID Mapping (ElevenLabs)

**Durum:** Accepted (2026-04-24 — user onayı)

**Bağlam:**
- Mevcut kod tek bir default voice ID kullanıyor (`ELEVENLABS_DEFAULT_VOICE_ID`).
- 5 farklı persona (Ahmet Yılmaz, Murat Kaya, Neslihan Bozkurt, Selin Çelik, + 1 yeni) ve 1 debrief koçu birbirinden farklı olmalı.
- Kullanıcı (F3): "Her persona'nın ses ID'si farklı olmalı, debrief için ayrı öneri istiyorum."

**Karar:**
- `personas` tablosuna `voice_id TEXT` kolonu eklenir (migration).
- Her persona için ElevenLabs TR kataloğundan uygun ID seçilir:
  - Demografiye uygun (yaş, cinsiyet, ton)
  - Karakter profiline uygun (direnişçi = sert ton; tecrübeli = derin; yeni başlayan = taze)
- AI Engineer aday voice ID'leri listeler, kullanıcı dinleyip seçer.
- Debrief koçu için ayrı voice ID env'de: `ELEVENLABS_DEBRIEF_COACH_VOICE_ID` — warm, tok ton (koçluk karakteri).
- TTS çağrısında voice ID dinamik seçilir (persona mode'da persona.voice_id, debrief mode'da env).

**Sonuçlar:**
- **Artı:** Her persona "farklı bir insan" hissi. Immersion artar.
- **Artı:** Debrief karakteri geçişi belirgin — "koç geldi" duygusu.
- **Eksi:** ElevenLabs voice kalite uniformity riski (TR kataloğu sınırlı).
- **Eksi:** Admin persona oluştururken voice ID seçmek zorunda — UI'ya ek adım (Phase 2'de sadece seed, admin custom persona Phase 3+).

**Alternatifler düşünüldü:**
- **(a)** Tek voice ID kalsın (MVP) — immersion zayıf, ayırt edilemez.
- **(b)** Voice cloning (her persona için özel ses kaydı) — Phase 3+ için overkill.
- **(c)** OpenAI TTS voices — TR kalite ElevenLabs kadar iyi değil.

---

### ADR-015 — Development Plan Aggregation

**Durum:** Accepted (2026-04-24 — user onayı)

**Bağlam:**
- Kullanıcının her seans rapor sayfasında o seansın development_areas'ı var.
- Ama **uzun vadeli gelişim yolu** ayrı bir ürün değeri — "5 seansın sonunda dinleme beceriniz hâlâ düşük, size Etkin Dinleme kursu öneriyoruz".
- Kullanıcı bu bilgiyi dashboard ve profilim sayfalarında sürekli görmek istiyor (yeni gereksinim eklendi).

**Karar:**
- Yeni tablo: `user_development_plans` — user başına 1 kayıt, TTL 30 gün.
- Her evaluation tamamlandığında QStash ile `/api/users/[id]/development-plan/regenerate` tetiklenir (10 sn delay).
- Throttle: 24 saat içinde plan güncellenmişse skip.
- Aggregate LLM prompt son 5 completed evaluation'ı alır → JSON:
  - `top_strengths` (tutarlı yüksek skor)
  - `priority_development_areas` (tutarlı düşük skor)
  - `training_recommendations` (TR eğitim pazarına uygun)
  - `book_recommendations` (Türkçe erişilebilir kitaplar)
  - `coach_note` (motivasyon notu)
- Dashboard widget + profilim tab + `/tenant/users/[id]` detay sayfasında gösterilir.
- Sesli rapor'daki eğitim/kitap önerisi bölümü bu plandan çekilir.

**Sonuçlar:**
- **Artı:** Kullanıcı sürekli bir gelişim hikayesi görür — engagement artar.
- **Artı:** Tenant admin/HR kişi bazlı plan görebilir — organizasyonel gelişim yönetimi.
- **Artı:** Öğrenme önerileri ürün farkı yaratır ("sadece değerlendirme değil, yol haritası").
- **Eksi:** Ek LLM çağrısı maliyeti (her evaluation sonrası throttle'lı).
- **Eksi:** Plan "stale" olabilir — 30 gün sonra güncel değil uyarısı gerekli.

**Alternatifler düşünüldü:**
- **(a)** Plan yok, sadece seans bazlı development_areas — uzun vadeli değer zayıf.
- **(b)** Plan kullanıcı manuel tetikler — engagement düşer.
- **(c)** Plan günlük tazelenir — maliyet ve anlamsızlık (günlük yeni data yoksa).

---

### ADR-016 — Persona Roleplay Sözleşmesi Parametrikleştirme

**Tarih:** 2026-04-26
**Durum:** **Accepted** (2026-04-26 oturumunda kararlaştırıldı)
**Faz:** Phase 1 = Pre-launch (4.5 saat, low-risk), Phase 2 = Post-launch (~2 hafta)

#### Bağlam

2026-04-26 testlerinde kritik bir ürün hatası tespit edildi (`ROLE-INVERSION-001`): AI persona kullanıcıya koç gibi davranıp soru soruyordu. Kök neden, `system-prompt.builder.ts`'in eklediği rubric ve phase direktiflerinin AI'ı koç moduna sokmasıydı (rubric: "bu boyutları aktive edecek sorular sor", phase: "exploration: keşfet, sorular sor", "action: aksiyonlar belirle, taahhüt al" — hepsi koç eylemleri).

İlk fix builder'a hard-coded "roleReminder" bölümü ekleyerek davranışı düzeltti — ama kullanıcı (Özcan) önemli bir mimari noktayı vurguladı:

> *"Bu sistem ileride pivot edip, kullanıcıyı hem koç hem koçluk gören kişi olarak tanımlamak istenebilir. Bu nedenle hard code olarak hiç bir şey olmasını istemem. Her şey parametrik olmalı."*

Mevcut sistem ürün spec'iyle uyumlu (kullanıcı = koç, AI = çalışan, rubric = kullanıcının koçluk skorları), ama esnek değil — yeni roleplay türleri (mentee koçluk alıyor, satış pitch, mülakat) eklemek için engineering iş gerekir.

#### Karar

Roleplay sözleşmesi **persona kaydının parçası** olur. Uygulama kodu içerikten içerik üretmez; sadece veriden gelen içeriği şekillendirir.

**Phase 1 (Pre-launch — minimum viable, low-risk, ~4.5 saat):**
- `personas.roleplay_contract TEXT` — kim hangi rolde, ne yapar/yapmaz
- `personas.opening_directive TEXT` — persona'nın seans başında nasıl davranacağı (`{USER_NAME}` interpolation)
- `system-prompt.builder.ts` hard-coded `roleReminder`'ı persona kaydından okur; NULL ise `DEFAULT_ROLE_CONTRACT` constant'ına fallback (zero regression)
- `VoiceSessionClient.tsx` greeting trigger generic'leşir
- Mevcut 5 persona için seed migration ile current contract DB'ye yazılır

**Phase 2 (Post-launch — tam parametrik, ~2 hafta):**
- `personas.roleplay_mode TEXT` — preset kodu (audit + UI helper için)
- `personas.phase_taxonomy JSONB` — faz isimleri ve min tur sayıları
- `personas.evaluation_target TEXT` — `user` veya `persona` (kim değerlendirilir)
- 4 starter mode preset: `coaching_user_as_coach`, `coaching_user_as_coachee`, `sales_user_as_seller`, `interview_user_as_interviewer`
- 3 yeni rubric template (mentee growth, sales skills, interview skills)
- PersonaForm mode dropdown + PhaseTaxonomyEditor
- Builder dinamik phase directives (`phase_taxonomy` JSON'dan üretilir)
- Evaluation engine `evaluation_target`-aware

#### Reddedilen Alternatifler

**Alternative 1: Tüm sözleşme persona prompt'unun içine yazılsın (`persona_prompt_versions`)**
- Ret nedeni: Persona prompt'u "karakter" tanımlar, sözleşme orthogonal bir concern. Mode preset'i karakteri etkilemeden değiştirebilmeli.

**Alternative 2: Tenant-level config (her tenant kendi sözleşmesini tanımlar)**
- Ret nedeni: Aynı tenant farklı persona'larla farklı roleplay türleri (koçluk + satış + mülakat) yürütmek isteyebilir. Tenant değil, persona-level granularity gerek.

**Alternative 3: Strüktürel JSON sözleşme (her alanı ayrı kolon)**
- Ret nedeni: Free-form text esneklik sağlar; LLM nuanslı talimatları yapısal alanlardan daha iyi yorumluyor. Yapı taşıyıcı UI helper (mode preset) zaten bu yapıyı sunuyor.

#### Sonuçlar

- Yeni roleplay türleri kod değişikliği olmadan eklenebilir (Phase 2 sonrası: mode preset eklemek bile tek constant değişikliği)
- Pivot esnekliği: kullanıcı = koçluk gören senaryosuna geçiş, sadece persona kaydı düzenlemesi
- Süper admin yükü artar: her persona için sözleşme yazmak/seçmek gerekir (mode preset prefill ile hafifletilir)
- Test yüzeyi mode başına genişler

#### Belgeler

- `Pre_Launch_Phase_1.md` — Phase 1 detaylı plan (6 iş paketi, ~4.5 saat)
- `Post_Launch_Phase_2.md` — Phase 2 detaylı plan (8 iş paketi, ~2 hafta)

---

### ADR-017 — ElevenLabs Conversational AI Realtime Adapter

**Tarih:** 2026-05-02
**Status:** Accepted (spike olumlu sonuçlandı, branch `feat/voice-elevenlabs-spike`)
**Decision drivers:** Mevcut Whisper+ElevenLabs+OpenAI sıralı pipeline'ında turn latency 3-5 saniye. Pilot launch'tan sonra "AI çok yavaş" geri bildirimi gelirse hızlı bir geçiş yolu hazır olsun.

#### Bağlam

Mevcut sesli seans akışı 3 ayrı vendor ve 3 ayrı round-trip kullanıyor: STT (Whisper) → LLM (GPT-4o) → TTS (ElevenLabs Turbo v2.5). Her round-trip ortalama 1-1.5 saniye, toplam algılanan latency 3-5 saniye. Bu, gerçek koçluk konuşma akıcılığının altında.

ElevenLabs Conv. AI üç katmanı tek WebSocket içinde birleştiriyor (server-side VAD + LLM hop + persona ses üretimi). 2026-05-02'de spike branch'inde 4 farklı LLM ile end-to-end test yapıldı. Sonuçlar `spike_elevenlabs_conv_ai.md`'da:

- **GPT-4o:** Latency düşük ama persona ROLE-INVERSION yapıyor (mevcut prod'daki çözümlü bug yeniden ortaya çıkıyor)
- **Claude 4.5:** Persona kalitesi mevcut prod'tan daha iyi ama uzun cevaplar nedeniyle algılanan latency yüksek
- **GPT-5.4:** Persona kalitesi mükemmel + cevap kısalığı en iyi + ~1s algılanan latency + maliyet en düşük (kazanan)

#### Karar

ElevenLabs Conv. AI adapter'ı **mevcut pipeline'ın yanında, ek bir engine seçeneği olarak** kabul edilir. Mevcut adapter mimarisine uygun: `src/adapters/realtime/` klasörü altında provider-agnostic interface, ilk implementation `elevenlabs-conv.adapter.ts`.

**Koexistence prensipleri:**
1. **Mevcut akış default kalır.** Hiçbir tenant/persona zorla taşınmaz.
2. **`personas.engine_preference` kolonu** (yeni, migration 053): `'classic' | 'realtime'`, default `'classic'`. Süper admin per-persona seçer.
3. **`tenants.default_engine` kolonu** (yeni): tenant düzeyinde default. Persona override eder.
4. **Feature flag `realtimeVoice`:** Initial rollout'ta sadece pilot tenant'lar için açık.
5. **Production prompt zinciri (`buildSystemPrompt`) Conv. AI override'ına aktarılır.** Spike'ta doğrulandı: aynı 6620 char prompt persona davranışını koruyor.
6. **PHASE direktiflerini Conv. AI'a göndermeden önce strip et.** Conv. AI agent çıktısını doğrudan TTS'ye gönderiyor; bracket marker'lar sesli okunuyor. Phase tracking Conv. AI yolunda Conv. AI tool call ile yeniden bağlanır (P-C-005).
7. **LLM seçimi GPT-5.4** (ElevenLabs built-in, Custom LLM gerekmez). Persona kalitesi + cevap kısalığı + maliyet eşitlemesinde galibiyet.
8. **Persona-spesifik voice ID korunur.** ElevenLabs Conv. AI agent override'ı persona voice ID'sini runtime'da set ediyor — mevcut yatırım bozulmaz.

#### Karşılaştırma — kazanım tablosu

| Boyut | Mevcut Prod | Conv. AI + GPT-5.4 |
|---|---|---|
| First-audio latency | ~3-5s | ~1s |
| Maliyet/seans | ~$0.40 | ~$0.22 (~45% ucuz) |
| Persona kalitesi | ✅ Tam | ✅ Tam (production prompt) |
| Persona-spesifik ses | ✅ | ✅ (override aktarıldı) |
| Phase tracking UI | ✅ Chat route strip + UI |  ⚠️ Faz C'de tool call ile bağlanacak |
| Türkiye region (KVKK) | ❌ | ❌ (kritik müşteride değerlendir) |

#### Reddedilen alternatifler

- **OpenAI Realtime API geçişi (R&D-001):** Persona-spesifik ses kavramı kaybolur (sadece 6-10 OpenAI ses preset). AION Mirror'ın değer önerisini bozar.
- **Azure OpenAI Realtime:** Setup karmaşık (Azure subscription, RBAC, VNet) + Türkçe Neural Voice 2-3 ses sınırlı.
- **İkinci ayrı proje:** Auth, dashboard, evaluation, raporlama %80 kod duplikasyonu olur. Adapter olarak ekleme tek codebase'de tek schema sağlar.
- **Custom LLM (Conv. AI içinden direkt OpenAI çağrısı):** Spike sonucu GPT-5.4 built-in seçimiyle persona kalitesi zaten yeterli; custom LLM ek karmaşıklık karşılığı marjinal kazanç. Faz C'de gerekirse opsiyonel olarak değerlendirilir.

#### Sonuçlar

- Yeni adapter mimarisi gerekli: `src/adapters/realtime/{interface,elevenlabs-conv.adapter}.ts`
- Yeni client component: `RealtimeVoiceSessionClient.tsx` (klasik `VoiceSessionClient` paralelde çalışır)
- Schema değişikliği: migration 053 (`engine_preference`, `default_engine`, `agent_id` kolonları)
- 5 persona için ElevenLabs Conv. AI agent oluşturulması (manuel, persona başına ~15 dk)
- Feature flag `realtimeVoice` infra'ya eklenir (mevcut `features.ts` pattern)
- Phase tracking Conv. AI'da tool call ile re-implement edilir
- Latency telemetrisi WebSocket frame analizi ile daha güvenilir hale getirilir
- Pilot tenant rollout ile real-world validation

#### Belgeler

- `Gelistirme23Nisan/spike_elevenlabs_conv_ai.md` — spike planı + 4 model A/B test sonuçları + final karar
- Branch: `feat/voice-elevenlabs-spike` (referans için saklanır, Faz C implementation `feat/voice-realtime-faz-c` üzerinde başlar)

---

### Durum Özeti (2026-04-26 sonrası)

| ADR | Durum | Faz |
|---|---|---|
| ADR-001 — QStash env rename | Accepted (tamamlandı) | Phase 0 |
| ADR-002 — Badges schema unification | Accepted (tamamlandı, DB çalıştırma bekliyor) | Phase 0 |
| ADR-003 — Folder cleanup | Accepted (tamamlandı) | Phase 1 |
| ADR-004 — Feature flag infra | Accepted (tamamlandı) | Phase 1 |
| ADR-005 — Multi-env Supabase | Accepted (tamamlandı) | Phase 1 |
| ADR-006 — Test infra | Proposed | Phase 3 |
| ADR-007 — Resend SMTP adapter | Accepted (tamamlandı) | Phase 1 |
| ADR-008 — Role single source of truth | Accepted (tamamlandı) | Phase 0 |
| ADR-009 — Migration reproducibility | Proposed | Phase 3 |
| ADR-010 — OTP/Passwordless auth | Accepted (tamamlandı) | Phase 0/1 |
| **ADR-011 — Voice-only mode** | **Accepted (2026-04-24)** | **Phase 2** |
| **ADR-012 — Debrief + parallel evaluation** | **Accepted (2026-04-24)** | **Phase 2** |
| **ADR-013 — Rubric-aware transcript summarization** | **Accepted (2026-04-24)** | **Phase 2** |
| **ADR-014 — Per-persona voice ID** | **Accepted (2026-04-24)** | **Phase 2** |
| **ADR-015 — Development plan aggregation** | **Accepted (2026-04-24)** | **Phase 2** |
| **ADR-016 — Parametrik roleplay sözleşmesi** | **Accepted (2026-04-26)** | **Pre-Launch Phase 1 + Post-Launch Phase 2** |
| **ADR-017 — ElevenLabs Conv. AI realtime adapter** | **Accepted (2026-05-02, spike sonucu olumlu)** | **Post-Launch Faz C** |
