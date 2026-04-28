# AION Mirror / roleplay-saas — Sistem Analizi
**Tarih:** 2026-04-23
**Analiz tipi:** Codebase Onboarding (yalnızca gözlenen koda dayalı)
**Analiz eden:** Codebase Onboarding Engineer

> Bu belge, downstream agent'ların (Software Architect, Workflow Architect, Project Shepherd, DevOps Automator) üzerine plan kurabileceği olgu temelli bir temel sağlamak için hazırlanmıştır. Tüm tespitler, `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/` altındaki dosyaların okunmasıyla doğrulanmıştır.

---

## 1. Tek Cümlelik Özet

AION Mirror (paket adı `roleplay-saas`), Next.js 16 App Router + React 19 + Supabase (SSR) üzerine inşa edilmiş, çok tenant'lı bir AI roleplay koçluk SaaS'ıdır; kullanıcılar LLM tabanlı personalarla metin veya ses modunda koçluk seansları yapar, seans bitiminde bir LLM-tabanlı değerlendirici rubrikle puanlar ve gamification (rozet/XP/görev) sistemi çalışır.

---

## 2. 5 Dakikalık Açıklama

### Ana Görevler (kod ne yapıyor)
- **Kimlik doğrulama ve onay:** E-posta/şifre ile Supabase Auth girişi (`src/modules/auth/actions.ts` → `loginAction`), KVKK consent akışı (`src/app/(auth)/consent/page.tsx`, `consentAction`).
- **Seans yaşam döngüsü:** `pending → active → completed | dropped | cancelled | failed` (bkz. migration `20260419110400_007_session_system.sql`; geçişler `src/lib/actions/session.actions.ts` ve cron `src/app/api/cron/session-timeout/route.ts`).
- **Sohbet akışı:** SSE üzerinden OpenAI streaming (`src/app/api/sessions/[id]/chat/route.ts`) — faz markerı (`[PHASE:...]`) ve `[SESSION_END]` markerı parse edilir.
- **Değerlendirme pipeline'ı:** Seans bitince Upstash QStash ile kuyruğa alınır (`src/lib/evaluation/evaluation.queue.ts`) → alıcı route `src/app/api/sessions/[id]/evaluate/route.ts` → `runEvaluation` LLM'i JSON mode'da çağırır → `evaluations` + `dimension_scores` tablolarına yazar → `awardXPAndBadges` gamification'ı günceller.
- **Admin & Tenant yönetimi:** Super admin tenant'ları, persona-tenant atamalarını, prompt ve rubric yapılandırmalarını yönetir; tenant admin kullanıcıları, senaryoları, personaları ve gamification içeriğini yönetir.
- **Raporlama:** Manager/HR/Tenant admin için ekip/kurum genelinde dashboard raporları, CSV export.

### Ana Girdiler
- HTTP istekleri (App Router sayfaları, server actions, API route handler'ları)
- `FormData` üzerinden form gönderimleri
- SSE POST body'si (chat mesajları)
- Ses dosyaları (multipart — STT endpoint'i)
- Cron/QStash webhook'ları (evaluate, session-timeout, assign-weekly-challenges)
- Supabase Auth cookies / JWT (`user_metadata.role`, `user_metadata.tenant_id`)

### Ana Çıktılar
- SSE chunk'ları (`data: {"text":"..."}`)
- JSON responseları (health, STT, TTS, evaluate)
- Supabase DB yazımları (sessions, session_messages, evaluations, badges, challenges, prompt_logs, audit_logs, notifications)
- HTML (sunucu render'lı sayfalar)
- Yönlendirmeler (middleware + server actions)

### Anahtar Dosyalar (ilk 3 okumak yeterli)
1. `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/middleware.ts` — route koruması ve Supabase session refresh
2. `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/src/app/layout.tsx` + `src/app/(dashboard)/layout.tsx` — root layout ve auth guard
3. `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/CLAUDE.md` — ekip tarafından yazılmış mimari özet (içerik doğrulandı, büyük ölçüde güncel)

### Ana Kod Patikaları
- **Login → Dashboard:** `/login` page → `loginAction` server action → `supabase.auth.signInWithPassword` → `hasConsent()` kontrol → role'e göre `/admin` / `/tenant` / `/dashboard` redirect.
- **Yeni seans:** `/dashboard/sessions/new?persona=<id>` → `createSessionAction` → DB'ye `pending` seans → `/dashboard/sessions/[id]` sayfası `activateSessionAction` tetikler → system prompt şifreli `prompt_logs`'a yazılır → status `active` → `SessionClient`/`VoiceSessionClient` client state'i.
- **Chat turu:** `SessionClient` → `POST /api/sessions/[id]/chat` → `decrypt(systemPrompt)` → `OpenAILLMAdapter.streamChat` → SSE chunk'ları → `saveSessionMessage` → faz marker'ı/SESSION_END parse.
- **Değerlendirme:** `endSessionAction` → QStash publishJSON → `/api/sessions/[id]/evaluate` → `runEvaluation` → `awardXPAndBadges`.

---

## 3. Derinlemesine İnceleme

### 3.1 Tip & Runtime
- **Tip:** Multi-tenant SaaS web uygulaması (tek Next.js app).
- **Runtime:** Node.js (Next.js App Router; middleware edge-runtime uyumlu). Browser client for SSE + MediaRecorder + WebAudio (voice).
- **Dil:** TypeScript `^5` (strict) — `tsconfig.json`.
- **Paket adı:** `roleplay-saas` (version `0.1.0`) — `package.json`.

### 3.2 Tech Stack (package.json'dan kesin versiyonlar)

**Runtime dependencies:**
| Paket | Versiyon | Rol |
|---|---|---|
| `next` | `16.2.4` | Framework (App Router) |
| `react` / `react-dom` | `19.2.4` | UI |
| `@supabase/ssr` | `^0.10.2` | SSR client + cookie yönetimi |
| `@supabase/supabase-js` | `^2.103.3` | Service-role client & auth admin |
| `@upstash/qstash` | `^2.10.1` | Background job kuyruğu (evaluate, cron) |
| `@upstash/redis` | `^1.37.0` | Paketli, src'de import yok (gözlem: kullanılmıyor) |
| `openai` | `^6.34.0` | LLM + Whisper |
| `elevenlabs` | `^1.59.0` | TTS |
| `onnxruntime-web` | `^1.24.3` | VAD web desteği |
| `@ricky0123/vad-web` | `^0.0.30` | Voice activity detection |
| `resend` | `^6.12.0` | Paketli, src'de kullanımı bulunamadı |
| `zod` | `^4.3.6` | Şema doğrulama (server actions) |
| `react-hook-form` | `^7.72.1` + `@hookform/resolvers` | Formlar |
| `zustand` | `^5.0.12` | Client state (session/voice store) |
| `recharts` | `^3.8.1` | Dashboard grafikleri |
| `sonner` | `^2.0.7` | Toast |
| `lucide-react` | `^1.8.0` | İkonlar |
| `@radix-ui/*` | çoklu | shadcn/ui primitive |
| `@base-ui/react` | `^1.4.0` | Ek UI primitive (kullanım yeri doğrulanmadı) |
| `next-themes` | `^0.4.6` | Tema |
| `cmdk`, `date-fns`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `tw-animate-css`, `shadcn@^4.3.0` | — | UI/util |

**Dev dependencies:**
| Paket | Versiyon | Rol |
|---|---|---|
| `tailwindcss` + `@tailwindcss/postcss` | `^4` | Tailwind CSS v4 |
| `typescript` | `^5` | — |
| `eslint` `^9` + `eslint-config-next` `16.2.4` | — | Lint |
| `vitest` | `^4.1.4` + `@vitejs/plugin-react` `^6.0.1` | Unit test (yapılandırma dosyası bulunamadı) |
| `@playwright/test` | `^1.59.1` | E2E (yapılandırma dosyası bulunamadı) |
| `@testing-library/react` `^16.3.2` + `@testing-library/jest-dom` `^6.9.1` | — | Komponent testi |
| `@types/node` `^25.6.0` | — | (NOT: Node 25 typings; çalışma zamanı versiyonu belirtilmemiş) |

**Scripts (`package.json`):**
- `npm run dev` → `next dev`
- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run lint` → `eslint`
- **YOK:** `typecheck`, `test`, `test:e2e` scriptleri tanımlı değil. Test kütüphaneleri yüklü fakat yapılandırma dosyası (`vitest.config.*`, `playwright.config.*`) deposunun kökünde veya `src/` altında bulunamadı.

### 3.3 Repository Yapısı (kök)

```
roleplay-saas/
├─ .claude/                  Claude Code ayarları
├─ .env.local                (secrets — OPENAI/ELEVENLABS/QSTASH boş)
├─ .env.local.example
├─ AGENTS.md                 Agent notları — Next.js 16 uyarısı
├─ CLAUDE.md                 Ekip mimari özeti (içeriği doğrulandı)
├─ Gelistime.md .. Gelistime4.md   Kullanıcının Türkçe feedback notları
├─ Gelistirme23Nisan/        Bu raporun bulunduğu klasör
├─ README.md                 Varsayılan CRA tarzı README (özelleştirilmemiş)
├─ components.json           shadcn config (slate baseColor)
├─ docs/phases/              BOŞ (.gitkeep)
├─ eslint.config.mjs
├─ middleware.ts             Route koruması + session refresh
├─ next.config.ts            Supabase storage remote pattern
├─ package.json
├─ postcss.config.mjs
├─ public/                   Logo + default SVG'ler
├─ scripts/                  bootstrap-users.mjs, create-test-user.*, test-signup.mjs
├─ src/
├─ supabase/
│   ├─ config.toml
│   ├─ migrations/           30+ SQL (14 sıralı + 14 tarih-damgalı)
│   └─ seed/                 dev_seed.sql
├─ tsconfig.json
└─ .next/                    (build cache)
```

### 3.4 `src/` Düzeni

```
src/
├─ adapters/                 Adapter pattern (LLM/STT/TTS)
│   ├─ llm/{index.ts, interface.ts, openai.adapter.ts}
│   ├─ stt/{index.ts, interface.ts, openai.adapter.ts}
│   └─ tts/{index.ts, interface.ts, elevenlabs.adapter.ts}
├─ app/                      App Router
│   ├─ (admin)/              BOŞ route grup (sadece .gitkeep'ler)
│   ├─ (auth)/               login, consent, layout.tsx
│   ├─ (dashboard)/          user/manager/tenant_admin/super_admin birleşik layout
│   │   ├─ admin/            super_admin rotaları (tenants, personas, prompts, rubrics)
│   │   ├─ dashboard/        user ana akışı (progress, achievements, sessions, profile...)
│   │   ├─ manager/          team + reports (ikisi de PlaceholderPage)
│   │   ├─ reports/          ekip/kurum raporları
│   │   ├─ sessions/new/     ESKİ: tenant scoped olmayan persona seçimi (flat)
│   │   └─ tenant/           tenant_admin rotaları
│   ├─ (manager)/            BOŞ route grup (sadece boş alt klasörler)
│   ├─ api/                  REST + SSE endpoints (aşağıda detay)
│   ├─ auth/callback/route.ts
│   ├─ dashboard/, manager/  KOMPLET BOŞ dizinler (yalnızca alt klasör iskeletleri)
│   ├─ \(dashboard\)/        FS-yerli olarak "\(dashboard\)" adında fazladan klasör (escape kaçağı; içinde sadece boş sessions/new)
│   ├─ layout.tsx, globals.css, favicon.ico
├─ adapters -- üstte           (NOT: ayrıca src/lib/adapters/ da var — aşağıda)
├─ components/
│   ├─ admin/                AdminGuard, PersonaForm, TenantTable, PromptEditor, ...
│   ├─ charts/               (tek alt klasör, içerik tam sayılmadı)
│   ├─ common/               NotificationPoller, page-states, placeholder-page
│   ├─ dashboard/            DashboardStatCards, Charts, StatCard...
│   ├─ layout/               app-sidebar, app-header, mobile-nav
│   ├─ persona/              (küçük klasör)
│   ├─ reports/              TeamDimensionChart, TeamLeaderboard, CSVExportButton...
│   ├─ sessions/             SessionClient, VoiceSessionClient, CinematicPersonaStage, ChatBubble, ScenarioCard, report/, voice/
│   ├─ tenant/               GamificationForms, GamificationLists
│   └─ ui/                   shadcn + özel UI (~40 dosya)
├─ hooks/                    useServerAction, useHeartbeat, useVoiceRecorder, useNaturalVoice, useAudioPlayer, useSSERetry, useSessionUnloadGuard, useNotifications, useMobile
├─ lib/
│   ├─ actions/              10 server action dosyası
│   ├─ adapters/             stt.adapter.ts, tts.adapter.ts (IKINCI bir adapter yeri — ÇİFT)
│   ├─ audio-utils.ts, auth.ts, navigation.ts, toast.ts, utils.ts
│   ├─ encryption/           AES-GCM (prompt şifreleme)
│   ├─ evaluation/           evaluation.engine/.queue/.prompt.builder + gamification.service + transcript.service
│   ├─ gamification/         challenge.service.ts
│   ├─ logger/
│   ├─ queries/              6 read-only sorgu dosyası
│   ├─ queue/                BOŞ
│   ├─ session/              system-prompt.builder + message.service
│   ├─ supabase/             client.ts, middleware.ts, server.ts
│   └─ utils/
├─ modules/                  DDD-esque feature modülleri
│   ├─ analytics, auth, conversation, evaluation, gamification, notification, persona, prompt, scenario, session, tenant
│   (YALNIZCA `auth` klasörü dolu — actions/service/types/index.ts. Diğer 10 klasör iskelet.)
├─ reducers/                 session.reducer.ts
├─ stores/                   session.store.ts, voice-session.store.ts (Zustand)
└─ types/
    └─ index.ts              AppUser, Tenant, Persona, Scenario, UserRole, ...
```

**Önemli düzensizlikler (kanıtlı):**
- `src/app/dashboard/` ve `src/app/manager/` (parantez**siz**) dizinleri var ve **tamamen boş** alt klasör iskeletleri içeriyor (`dashboard/admin/`, `dashboard/login/`, `manager/voice/`, ...). Bunlar gerçek App Router rotaları olmadığı için Next.js tarafından sayfa üretmez fakat dizin karışıklığına yol açar.
- `src/app/(admin)/` ve `src/app/(manager)/` parantezli route grupları da fiilen **boş** (`.gitkeep` dosyalarından ibaret); gerçek admin rotaları `src/app/(dashboard)/admin/` altında yaşıyor.
- `src/app/\(dashboard\)/` — tam olarak `\(dashboard\)` karakterli bir klasör (shell escape hatası) içinde sadece boş `sessions/new/` alt dizini var. Bu bir git artığı.
- `src/adapters/` ile `src/lib/adapters/` paralel iki adapter klasörü var. `src/adapters/stt/openai.adapter.ts` dururken, `/api/sessions/[id]/stt/route.ts` `@/lib/adapters/stt.adapter` import ediyor — iki ayrı adapter varlığı. `CLAUDE.md` yalnızca `src/adapters/`'ı belgeliyor; `src/lib/adapters/`'ın varlığı belgeye yansımamış.

### 3.5 Entry Point'ler

| Dosya | Görevi |
|---|---|
| `middleware.ts` | Herkesin ilk geçtiği nokta; `PUBLIC_ROUTES`, `SUPER_ADMIN_ROUTES`, `ADMIN_ROUTES`, `MANAGER_ROUTES` kontrolleri + Supabase session refresh (`updateSession`). |
| `src/app/layout.tsx` | Root layout; Manrope + Newsreader fontları, Toaster. `lang="tr"`. `robots: { index: false, follow: false }`. |
| `src/app/(auth)/layout.tsx` | Login/consent için iki sütunlu marka ekranı. |
| `src/app/(dashboard)/layout.tsx` | `getAuthSession()` → yoksa `/login` → consent yoksa `/consent` → sidebar + header + NotificationPoller. |
| `src/app/auth/callback/route.ts` | OAuth/email callback (ama login akışı `signInWithPassword` kullanıyor; callback şu an yalnızca hata fallback'i gibi çalışıyor). |
| `src/app/(dashboard)/tenant/layout.tsx` | `AdminGuard` → `['tenant_admin','super_admin']`. |
| `src/app/(dashboard)/admin/layout.tsx` | `AdminGuard` → `'super_admin'`. |

### 3.6 Routing Map

**Sayfa rotaları (tümü `src/app` altında):**

| URL | Dosya | Rol kısıtı |
|---|---|---|
| `/login` | `(auth)/login/page.tsx` | Public |
| `/consent` | `(auth)/consent/page.tsx` | Giriş yapmış |
| `/dashboard` | `(dashboard)/dashboard/page.tsx` | Herhangi auth'lu |
| `/dashboard/sessions` | `(dashboard)/dashboard/sessions/page.tsx` | Auth'lu |
| `/dashboard/sessions/new` | `(dashboard)/dashboard/sessions/new/page.tsx` | Auth'lu (role `user`/`manager`) |
| `/dashboard/sessions/[id]` | `(dashboard)/dashboard/sessions/[id]/page.tsx` | Seans sahibi |
| `/dashboard/sessions/[id]/report` | `(dashboard)/dashboard/sessions/[id]/report/page.tsx` | Seans sahibi |
| `/dashboard/progress` | `(dashboard)/dashboard/progress/page.tsx` | **PlaceholderPage** |
| `/dashboard/achievements` | `(dashboard)/dashboard/achievements/page.tsx` | — (gerçek içerik) |
| `/dashboard/profile` | `(dashboard)/dashboard/profile/page.tsx` | Auth'lu |
| `/dashboard/notifications` | `(dashboard)/dashboard/notifications/page.tsx` | **PlaceholderPage** |
| `/sessions/new` | `(dashboard)/sessions/new/page.tsx` | **ESKİ/ÇIFT** — yeni akış `/dashboard/sessions/new` |
| `/admin` | `(dashboard)/admin/page.tsx` | super_admin |
| `/admin/tenants` | `(dashboard)/admin/tenants/page.tsx` | super_admin |
| `/admin/personas` | `(dashboard)/admin/personas/page.tsx` | super_admin (persona-tenant atama) |
| `/admin/prompts` | `(dashboard)/admin/prompts/page.tsx` | super_admin |
| `/admin/rubrics` | `(dashboard)/admin/rubrics/page.tsx` | super_admin |
| `/tenant` | `(dashboard)/tenant/page.tsx` | tenant_admin / super_admin |
| `/tenant/users` | `(dashboard)/tenant/users/page.tsx` | tenant_admin / super_admin |
| `/tenant/personas` | `(dashboard)/tenant/personas/page.tsx` | tenant_admin / super_admin |
| `/tenant/personas/new` | `(dashboard)/tenant/personas/new/page.tsx` | super_admin (listeleme butonu koşullu) |
| `/tenant/personas/[id]/edit` | `(dashboard)/tenant/personas/[id]/edit/page.tsx` | — |
| `/tenant/scenarios` | `(dashboard)/tenant/scenarios/page.tsx` | tenant_admin / super_admin |
| `/tenant/scenarios/new` | `(dashboard)/tenant/scenarios/new/page.tsx` | — |
| `/tenant/scenarios/[id]/edit` | `(dashboard)/tenant/scenarios/[id]/edit/page.tsx` | — |
| `/tenant/gamification` | `(dashboard)/tenant/gamification/page.tsx` | tenant_admin / super_admin |
| `/manager/team` | `(dashboard)/manager/team/page.tsx` | **PlaceholderPage** |
| `/manager/reports` | `(dashboard)/manager/reports/page.tsx` | **PlaceholderPage** |
| `/reports` | `(dashboard)/reports/page.tsx` | manager/hr_viewer/tenant_admin/super_admin |
| `/reports/users/[userId]` | `(dashboard)/reports/users/[userId]/page.tsx` | — |

**Middleware'de tanımlanıp SAYFASI OLMAYAN korumalar:**
- `/admin/system` — middleware'de `SUPER_ADMIN_ROUTES`'da listelenmiş fakat `src/app/(dashboard)/admin/system/` yok.

**API rotaları (tümü `src/app/api` altında):**

| URL | Dosya | Açıklama |
|---|---|---|
| `GET /api/health` | `api/health/route.ts` | Supabase + env anahtarları probu |
| `GET /auth/callback` | `app/auth/callback/route.ts` | OAuth code → session |
| `POST /api/sessions/[id]/chat` | `api/sessions/[id]/chat/route.ts` | SSE streaming chat (ana akış) |
| `POST /api/sessions/[id]/evaluate` | `api/sessions/[id]/evaluate/route.ts` | QStash imzalı değerlendirme işçisi |
| `POST /api/sessions/[id]/heartbeat` | `api/sessions/[id]/heartbeat/route.ts` | `last_activity_at` güncellemesi |
| `POST /api/sessions/[id]/drop` | `api/sessions/[id]/drop/route.ts` | Manuel drop (içerik okunmadı, dosya mevcut) |
| `POST /api/sessions/[id]/stt` | `api/sessions/[id]/stt/route.ts` | Whisper transkripsiyon |
| `POST /api/sessions/[id]/tts` | `api/sessions/[id]/tts/route.ts` | ElevenLabs TTS (dosya mevcut, içerik okunmadı) |
| `POST /api/cron/session-timeout` | `api/cron/session-timeout/route.ts` | 30dk inaktif seansları `dropped` yapan QStash cron |
| `POST /api/cron/assign-weekly-challenges` | `api/cron/assign-weekly-challenges/route.ts` | Pazartesi sabahı haftalık görev dağıtımı |

**Boş API dizinleri (hep `.gitkeep`):**
`src/app/api/admin/`, `src/app/api/evaluation/`, `src/app/api/gamification/`, `src/app/api/notifications/`, `src/app/api/personas/`, `src/app/api/reports/`, `src/app/api/scenarios/`, `src/app/api/voice/stt/`, `src/app/api/voice/tts/`. Bunlar iskelet; fiili endpoint'ler yok.

### 3.7 Data Model (Supabase migrations)

**Migration zamanlama anomalisi:** `supabase/migrations/` altında **iki farklı isimlendirme rejimi** var:
- Tarih damgalı: `20260419102854_001_tenants_and_roles.sql` … `20260422_023_storage_avatars_bucket.sql`
- Plain numerik: `014_session_activity.sql` … `022_fix_persona_tenant_rls.sql`, `022_update_rls_manager_access.sql`

Bu iki seriyi Supabase CLI aynı sırada uygulamaz; `022` numarasının hem plain hem de tarihli versiyonu var (`022_fix_persona_tenant_rls.sql` ve `022_update_rls_manager_access.sql`). **Sıralama/idempotency riski** mevcut (AGENTS.md zaten bunu uyarıyor: idempotent yazın).

**Tanımlanan enum tipleri:**
- `user_role` → `super_admin | tenant_admin | hr_admin | manager | user` (migration 001). **NOT:** Migration enum'unda `hr_viewer` **YOK**, oysa `src/types/index.ts` `UserRole`'da `hr_viewer` var ve middleware `hr_viewer`'ı ayrıcalıklı sayıyor. Fark.
- `kpi_code`, `personality_type`, `emotional_state` (003)
- `session_status`, `session_phase`, `cancellation_reason` (007)
- `badge_category`, `challenge_type` (009)
- `notification_type` (011)
- `rubric_dimension_code` (005'ten referans var)

**Tablolar (migration'lardan derlenmiş):**

| Tablo | Migration | Notlar |
|---|---|---|
| `tenants` | 001 | slug unique, `is_active`, `brand_color` default `#4F46E5`, `website_url` (019 ile) |
| `users` | 001 | `auth.users(id)` ile 1:1, `role`, `tenant_id`, `manager_id` (018), `title/position/department/username` (014 profile fields) |
| `consent_records` | 001 | KVKK |
| `personas` | 003 + genişlemeler (016, 017, 20260421_017) | `tenant_id NULL = global`; `avatar_image_url`, `location`, kpis, growth_type ... |
| `persona_kpis` | 003 | Kişi başına KPI (nomlanmış) |
| `persona_prompt_versions` | 003 | AES-GCM şifreli prompt versiyonları |
| `prompt_templates`, `prompt_versions` | 004 | Sistem/değerlendirme/manager insights template'leri |
| `rubric_templates`, `rubric_dimensions` | 005 | Rubrik yapısı |
| `scenarios` | 006 + 20260421_018 (align) + mood_hint (020) | `persona_id`, `rubric_template_id`, `target_dimension_codes`, `tenant_id` |
| `sessions` | 007 + 014 + 20260422_022 (session_mode) | `status, phase, started_at, completed_at, last_activity_at, duration_seconds, summary_encrypted, session_mode ('text'\|'voice')` |
| `session_messages` | 007 | Şifreli turn'ler |
| `evaluations` | 008 | `overall_score 0..5`, `strengths[]`, `development_areas[]`, `coaching_note`, `manager_insight`, status |
| `dimension_scores` | 008 | Boyut bazlı puanlama |
| `gamification_profiles` | 009 | `total_points`, `level`, `streak_days`, `last_session_date` |
| `badges` | 009 + 20260422_021 (schema fix) | `code UNIQUE`, `category`, `criteria JSONB`. Fix migration'ı `tenant_id`, `badge_code`, `xp_reward`, `icon` ekledi. **Ciddi uyarı**: Koddaki `createTenantBadgeAction` (`src/lib/actions/gamification.actions.ts`) hâlâ `name`/`description`/`category` alıyor; orijinal migration'da `code NOT NULL`, `name NOT NULL`, `description NOT NULL`. Fix migration'ı `badge_code`'u **NULLABLE** eklemiş; fakat orijinal `code` sütunu hâlâ `NOT NULL UNIQUE`. Gelistime3.md'deki "null value in column `badge_code`" ve Gelistime2.md'deki "null value in column `code`" hataları bu karışıklıktan kaynaklanıyor. |
| `challenges`, `user_challenges` | 009 + 20260422_021 (schema fix) | Fix migration `tenant_id`, `challenge_type`, `title`, `target_value`, `xp_reward`, `is_weekly` ekledi. Orijinal `name NOT NULL` sütunu hâlâ oracle'dan gelmediyse sorun çıkarır (Gelistime2.md'de zaten rapor edilmiş). |
| `point_transactions` | 009 | XP hareketleri |
| `usage_metrics` | 010 | Observability |
| `prompt_logs` | 010 | Her seansın şifreli system prompt'u burada |
| `audit_logs` | 011 | KVKK/Compliance (içerik okundu) |
| `notifications` | 011 | In-app bildirimler |
| `data_deletion_requests` | 011 | KVKK silme talepleri |
| `persona_tenant_mappings` | 021 | Persona-Tenant N:M atama (Gelistime.md'deki "Acme'a atanmış persona varsa" kuralının kaynağı) |
| `storage.buckets/avatars` | 20260422_023 | Public avatars bucket + RLS policy'leri |

**RLS helper fonksiyonları (002'de):**
- `auth_tenant_id()` — JWT `user_metadata.tenant_id`
- `auth_role()` — JWT `user_metadata.role`
- `is_super_admin()` — role == `super_admin`

**RLS Örüntüsü:** Çoğu tablo super_admin için `FOR ALL USING (is_super_admin())` + tenant-scoped `SELECT` + rol-bazlı `INSERT/UPDATE`. Persona ve scenario'da `tenant_id IS NULL` (global) + `tenant_id = auth_tenant_id()` kuralı (012_rls_all_tables.sql).

**Kanıtlı RLS endişeleri:**
- `gamification_profiles`, `user_badges`, `user_challenges`, `point_transactions`, `notifications`, `audit_logs` için policy'ler 012 içinde fakat **kapsamı derinlemesine okunmadı**; değişiklik öncesi 012'nin tamamı incelenmeli.
- 022_update_rls_manager_access.sql ve 022_fix_persona_tenant_rls.sql aynı migration numarasını paylaşıyor (muhtemelen farklı sıra ile uygulanıyor).

### 3.8 Authentication Flow

1. **Giriş:** `/login` sayfası (`'use client'`) → `useActionState(loginAction, ...)` → server action `src/modules/auth/actions.ts::loginAction`.
2. Supabase `signInWithPassword(email, password)`; hata kodlarına göre TR mesajlar.
3. `hasConsent(user.id)` çağrılır → `consent_records` tablosundan `user_id` sorgulanır.
4. `user_metadata.role`'a göre redirect: `super_admin → /admin`, `tenant_admin → /tenant`, diğerleri → `/dashboard`.
5. **Middleware** (`middleware.ts`): her istekte `updateSession` → Supabase cookie refresh. Giriş yapılmamış ve route public değilse `/login?next=...`'e redirect. Role'e göre `SUPER_ADMIN_ROUTES`, `ADMIN_ROUTES`, `MANAGER_ROUTES`, `ROLE_PROTECTED_ROUTES` kontrolü; uyumsuzsa `/dashboard`'a redirect.
6. **Layout-level guard:** `src/app/(dashboard)/layout.tsx` `getAuthSession()` ile double-check, consent yoksa `/consent`.
7. **Sayfa/server-action-level guard:** `getCurrentUser()` (`src/lib/auth.ts` → `src/modules/auth/service.ts`) + `AdminGuard` komponenti.
8. **Role verisi iki kaynak:** Middleware `user_metadata.role` (hızlı, JWT) kullanıyor; server action'lar `users.role` sütununu okuyor (`getCurrentUser`). **Kanıt:** bu iki kaynak senkron tutuluyor mu bilinmiyor; `user_metadata` değişmeden DB `role` değişirse middleware yanlış karar verir. Muhtemel tutarsızlık riski.
9. **Consent kaydı:** `consentAction` `consent_records`'a satır ekler, sonra `/dashboard`'a redirect.
10. **Çıkış:** `logoutAction` → `supabase.auth.signOut()` → `/login`.

### 3.9 Supabase Entegrasyon Noktaları

- **SSR client (RLS'ye uyar):** `src/lib/supabase/server.ts::createClient()` — `@supabase/ssr` + `next/headers cookies`. Alias: `createServerClient`.
- **Service-role client (RLS bypass):** `src/lib/supabase/server.ts::createServiceClient()` — `@supabase/supabase-js`. Alias: `createServiceRoleClient`.
- **Browser client:** `src/lib/supabase/client.ts` — anonim. Kullanım yerleri sınırlı (import edenleri taraması yapılmadı, yalnızca dosya mevcut).
- **Middleware client:** `src/lib/supabase/middleware.ts::updateSession` — cookie refresh + `getUser()`.
- **Storage:**
  - `avatars` bucket (public, 5MB, image MIME tipleri) — migration 20260422_023.
  - `personas` bucket — `src/lib/actions/storage.actions.ts` içinde runtime'da `listBuckets()` + `createBucket('personas', { public: true })` ile **kodda otomatik oluşturuluyor**. Migration yok.
  - `next.config.ts`'de sadece `dqmivckxqdvwlzudshlz.supabase.co` host'u `/storage/v1/object/public/**` için whitelist'lenmiş — **tek Supabase projesi hardcode edilmiş**. `.env.local`'daki URL de bu proje.
- **Realtime:** Kod tabanında `channel()`, `subscribe()` gibi realtime API'lerini gözleyen import bulamadım; **yok görünüyor**.
- **Edge Functions:** `supabase/functions/` klasörü yok; SERVİS Edge Function kullanılmıyor.

### 3.10 Environment Variables

**`.env.local.example` (kodla karşılaştırıldı):**

| Değişken | Example | Kod tarafından aranıyor mu? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ |
| `ENCRYPTION_KEY` | ✓ | ✓ (aes-gcm.ts, health) |
| `LLM_PROVIDER` | ✓ | ✓ (ama kullanıldığı yer tam okunmadı; OpenAI hard default) |
| `OPENAI_API_KEY` | ✓ | ✓ |
| `OPENAI_LLM_MODEL` | ✓ | ✓ (default `gpt-4o`; bir yerde `gpt-4.5` fallback!) |
| `STT_PROVIDER` | ✓ | ✓ |
| `TTS_PROVIDER` | ✓ | ✓ |
| `ELEVENLABS_API_KEY` | ✓ | ✓ |
| `ELEVENLABS_DEFAULT_VOICE_ID` | ✓ | ✓ |
| `QSTASH_URL` | ✓ | **KOD BUNU ARAMIYOR** |
| `QSTASH_TOKEN` | ✓ | **KOD BUNU ARAMIYOR** |
| `RESEND_API_KEY` | ✓ | **KOD BUNU ARAMIYOR** (resend paketi de import edilmiyor) |
| `NEXT_PUBLIC_APP_URL` | ✓ | Koddan okuma gözlenmedi |
| `APP_ENV` | ✓ | ✓ (health route) |
| `FEATURE_VOICE_ENABLED`, `FEATURE_GAMIFICATION_ENABLED`, `FEATURE_ANALYTICS_ENABLED` | ✓ | Kodda bu feature flag'ler aranmıyor |

**Kod tarafından aranıp example'da OLMAYAN:**
| Değişken | Nerede |
|---|---|
| `UPSTASH_QSTASH_TOKEN` | `src/lib/evaluation/evaluation.queue.ts` |
| `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` | 3 yerde (evaluate, session-timeout, assign-weekly-challenges) |
| `UPSTASH_QSTASH_NEXT_SIGNING_KEY` | 3 yerde |
| `QSTASH_RECEIVER_URL` | evaluation.queue.ts |
| `ELEVENLABS_MODEL` | (eleven adapter, içerik okunmadı fakat grep'te bulundu) |

`.env.local`'daki secret'lar **boş**: `OPENAI_API_KEY=`, `ELEVENLABS_API_KEY=`, `ELEVENLABS_DEFAULT_VOICE_ID=`, `QSTASH_TOKEN=`, `RESEND_API_KEY=`. Yalnızca Supabase anahtarları ve `ENCRYPTION_KEY` dolu.

### 3.11 Mevcut Sayfalar & Durum Tespiti

| Sayfa | Durum (okunan dosyadan) |
|---|---|
| `/login` | **Tamam** — fonksiyonel form |
| `/consent` | **Tamam** |
| `/dashboard` | **Tamam** — 9 paralel query + grafikler |
| `/dashboard/sessions` | **Tamam** |
| `/dashboard/sessions/new` | **Tamam** — 2 adımlı (persona → senaryo), `CinematicPersonaStage` |
| `/dashboard/sessions/[id]` | **Tamam** — SessionClient (text) ve VoiceSessionClient branch'i |
| `/dashboard/sessions/[id]/report` | **Tamam** — değerlendirme hazır değilse bekleme ekranı |
| `/dashboard/profile` | **Kısmi** — ProfileForm mevcut; Gelistime4.md'de "Profil güncellenemedi" hatası raporlanmış ve çözüm bildirilmiş |
| `/dashboard/progress` | **PLACEHOLDER** (tek satır: `<PlaceholderPage title='Gelişimim' />`) |
| `/dashboard/notifications` | **PLACEHOLDER** |
| `/dashboard/achievements` | **Kısmi** — XP hareketleri yerine "Henüz XP hareketi yok" fallback'i görünüyor (içerik dolu ama veri yoksa boş kalır) |
| `/sessions/new` (ESKİ) | **Dublikat/Eski** — yeni akışla çelişiyor; `Link href="/sessions/start?personaId=..."` gibi bir rota referans ediyor ama `/sessions/start` sayfası yok |
| `/admin` | **Tamam** — 3 count stat |
| `/admin/tenants` | **Tamam** |
| `/admin/personas` | **Tamam** (persona-tenant atama tablosu) |
| `/admin/prompts` | **Kısmi** — şablon yoksa "Henüz prompt template yok" |
| `/admin/rubrics` | **Kısmi** — boyut yoksa "Henüz rubric boyutu tanımlanmamış" |
| `/admin/system` | **EKSİK** — middleware'de koruyor fakat dosya yok |
| `/tenant` | **Tamam** (3 count stat) |
| `/tenant/users` | **Tamam** — InviteUserDialog ile yeni kullanıcı davet; Gelistime3.md'ye göre güncelleme/pasifleştirme bozuktu (status güncel bilinmiyor) |
| `/tenant/personas` (+ new, edit) | **Tamam** (UI), ancak Gelistime2.md #5: detay görünümü yetersiz notu mevcut (ama kodda `PersonaDetailSheet` var — çelişki) |
| `/tenant/scenarios` (+ new, edit) | **Kısmi** — ScenarioTable mevcut. Gelistime2.md #6: Acme Admin'de senaryo görünmüyor — veri kaynağı sorunu |
| `/tenant/gamification` | **Tamam** (UI). Gelistime4.md #1 CRUD fonksiyonları eklendi (`toggleBadgeStatusAction`, `deleteBadgeAction`, `toggleChallengeStatusAction`, `deleteChallengeAction`) |
| `/manager/team` | **PLACEHOLDER** |
| `/manager/reports` | **PLACEHOLDER** |
| `/reports` | **Tamam** — TeamStatCards + Leaderboard + DimensionChart + CSV export |
| `/reports/users/[userId]` | **Var** (içerik okunmadı) |

### 3.12 Komponent Envanteri

- **shadcn/ui (Radix tabanlı):** `src/components/ui/` altında 40+ dosya — alert, avatar, badge, breadcrumb, button, card, checkbox, command, dialog, dropdown-menu, form, input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, tooltip + **özel**: `ConfirmDialog`, `DataTable`, `LevelBar`, `StatusBadge`, `SubmitButton`, `Toaster`.
- **Admin:** `AdminGuard`, `CreateTenantDialog`, `EditUserDialog`, `InviteUserDialog`, `PageHeader`, `PersonaDetailDialog`, `PersonaDetailSheet`, `PersonaForm`, `PersonaGrid`, `PersonaImageUpload`, `PersonaTenantAssignment`, `PromptEditor`, `PromptTemplateList`, `RubricDimensionCard`, `ScenarioDetailSheet`, `ScenarioForm`, `TenantPersonaAssignment`, `TenantTable`, `UserTable`.
- **Dashboard:** 11 bileşen — charts (ScoreTrend, DimensionRadar, PersonaScore), kartlar, filtreler.
- **Sessions:** Ana `SessionClient`, `VoiceSessionClient`, cinematic sahne, persona/scenario seçim adımları, faz göstergesi, rapor alt-komponentleri (`report/`), voice yardımcıları (`voice/`).
- **Layout:** `app-header`, `app-sidebar`, `mobile-nav` (responsive nav).
- **Tenant:** `GamificationForms`, `GamificationLists` — formlar sunucu action'larıyla çalışıyor.
- **Reports:** 5 bileşen — takım tabloları, grafikler, CSV export.
- **Common:** `NotificationPoller` (poller, layout'ta start'lanıyor), `page-states`, `placeholder-page`.

### 3.13 Scripts & Tooling

- **`scripts/bootstrap-users.mjs`**: `.env.local` parse edip Supabase Admin API ile `admin@aion.com` (super_admin) ve `kullanici@aion.com` (manager) oluşturuyor. Default tenant ID: `00000000-0000-0000-0000-000000000001`.
- **`scripts/create-test-user.mjs` / `.ts`** ve `scripts/test-signup.mjs`: benzer test kullanıcı oluşturma yardımcıları (içerik derinlemesine okunmadı).
- **Lint:** `npm run lint` → ESLint 9 + `eslint-config-next` (16.2.4) + TypeScript preset.
- **Build:** `npm run build` (Next.js). `.next/` cache mevcut (en son 22 Nisan).
- **Test:** Vitest + Playwright + Testing Library kurulu fakat yapılandırma dosyası ve test dosyası yok — **test altyapısı eksik**.
- **Typecheck:** Script yok; AGENTS.md `npx tsc --noEmit` öneriyor. `tsconfig.tsbuildinfo` ~500KB — bir build edilmiş.

### 3.14 Mevcut Dokümantasyon

| Dosya | Özet |
|---|---|
| `CLAUDE.md` | Mimari özet, rol hiyerarşisi, Supabase client'ları, session lifecycle, adapter layer, chat API detayı, evaluation pipeline, env vars, data layer conventions, frontend conventions. **Büyük ölçüde koddaki durumla eşleşiyor.** Küçük sapma: QStash env isimleri `UPSTASH_QSTASH_TOKEN` vs. `.env.local.example`'daki `QSTASH_TOKEN`. |
| `AGENTS.md` | Next.js 16 uyarısı (`params` promise, `next/dynamic { ssr: false }` server component'larda yasak); `npm run lint`/`build`; RLS idempotency uyarısı. |
| `README.md` | **Özelleştirilmemiş** (create-next-app varsayılanı). Kurulum/deploy rehberi yok. |
| `Gelistime.md` | 14 madde Türkçe bug/feedback — tenant/persona pasif kontrolleri, scenario difficulty renkleri, tenant admin kullanıcı rolleri, gamification hataları (`code NOT NULL` ve `challenges RLS`), profil boşluğu vs. |
| `Gelistime2.md` | 10 madde — buton rengi, rol güncelleme hatası, persona detayı yetersizliği, gamification `name NOT NULL` ve `code NOT NULL` hataları, profil fotoğraf isteği. |
| `Gelistime3.md` | 10 madde — kullanıcı güncelleme/pasifleştirme/silme hataları, gamification `badge_code NOT NULL`, profil foto, yeni seans tasarımı, `session_mode` kolonu eksik hatası, buton rengi. |
| `Gelistime4.md` | 4 madde + yapılan değişiklikler log'u — Gamification CRUD action'ları eklendi, `avatars` bucket migration'ı yazıldı, profil update service-role'e çevrildi, seans tasarımı tam kaplama, persona `avatar_image_url` select'e eklendi. **Bu en yeni "done" log'u** ve bu değişiklikler koda yansımış görünüyor. |
| `docs/phases/` | **BOŞ** (.gitkeep) |
| `supabase/seed/README.md` | (içerik okunmadı) |

### 3.15 TODO / FIXME / Placeholder / Yarım İşler (kanıtlı)

- `grep -n "TODO\|FIXME"` tüm `src/` ağacında **0 match**. Bu genelde iyi sayılır, ama…
- **4 adet `PlaceholderPage` kullanımı** (tek satırlık sayfa):
  - `/dashboard/progress`
  - `/dashboard/notifications`
  - `/manager/team`
  - `/manager/reports`
- Boş iskelet klasörler (veya `.gitkeep` dolu):
  - `src/app/api/admin/`, `evaluation/`, `gamification/`, `notifications/`, `personas/`, `reports/`, `scenarios/`, `voice/stt/`, `voice/tts/`
  - `src/app/(admin)/*/`, `src/app/(manager)/reports/`, `src/app/(manager)/team/`
  - `src/app/dashboard/*`, `src/app/manager/*` (parantezsiz — **gürültü**)
  - `src/app/\(dashboard\)/sessions/new/` (escape'li garbage klasör)
  - `src/modules/` altında 10 klasör iskelet (sadece `auth` dolu)
  - `src/lib/queue/` boş
  - `docs/phases/` boş
- "Henüz veri yok" fallback'leri: progress, notifications, achievements, scenarios, rubrics, prompts, personas sayfalarında — bunlar **tasarım gereği boş-state mesajları**, kırık değil.
- Eski versiyonlar: `/sessions/new/page.tsx` eski akış (`/sessions/start?personaId=...`'a link veriyor; o rota yok).
- `session.actions.ts`'de `OPENAI_LLM_MODEL ?? 'gpt-4.5'` — model default inconsistency (`evaluation.engine.ts` ve `adapters/llm/openai.adapter.ts` `gpt-4o` default kullanıyor).

### 3.16 Gözlemlenen 3 Gerçek Kullanıcı Akışı (uçtan uca)

#### Akış 1: Giriş → Dashboard
1. Kullanıcı `GET /` → middleware'de public değil, cookie'den user çekilir → yoksa `/login?next=/` redirect.
2. `GET /login` → `(auth)/layout.tsx` + `(auth)/login/page.tsx` render edilir. `next` parametresi alert'le gösterilir.
3. Form submit → `loginAction` server action (`src/modules/auth/actions.ts`) → `supabase.auth.signInWithPassword`.
4. Başarılı → `hasConsent(user.id)` → yoksa `/consent` redirect; varsa role'e göre `/admin | /tenant | /dashboard` redirect.
5. Middleware role'i onaylar (`SUPER_ADMIN_ROUTES` vs.) → `(dashboard)/layout.tsx` çalışır → `getAuthSession()` + `getGamificationProfile()` → sidebar + header + `NotificationPoller` mount.
6. `(dashboard)/dashboard/page.tsx` 9 paralel query ile kartları doldurur.

**Dosyalar:** `middleware.ts`, `src/lib/supabase/middleware.ts`, `src/modules/auth/actions.ts`, `src/modules/auth/service.ts`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`.

#### Akış 2: Yeni seans oluşturma ve chat turu
1. Kullanıcı `/dashboard/sessions/new` → persona listesi (Adım 1: `PersonaSelectionStep`).
2. Persona seçince URL `?persona=<id>` olur → Adım 2: `CinematicPersonaStage` (senaryo seçimi + başlat butonu).
3. `createSessionAction(personaId, scenarioId, sessionMode)` → `sessions` INSERT (`status: 'pending'`, `session_mode: 'text'|'voice'`) → sessionId döner.
4. Client `/dashboard/sessions/[id]`'a yönlendirir.
5. `SessionPage` (`getActiveSessionData` + `activateSessionAction`) → `buildSystemPrompt(sessionId, personaId, scenarioId, tenantId)` → `encrypt(systemPrompt)` → `prompt_logs` INSERT (service-role) → `sessions.status = 'active'`, `phase = 'opening'`, `started_at` set.
6. `session_mode === 'voice'` ise `VoiceSessionClient`, değilse `SessionClient` render.
7. Kullanıcı mesaj gönderir → `POST /api/sessions/[id]/chat` JSON body `{ message }`.
8. Handler: auth → session doğrulama → **service-role** ile `prompt_logs`'tan son system prompt → `decrypt` → `getSessionHistory(40)` → `saveSessionMessage` (user rolüyle) → `OpenAILLMAdapter.streamChat` → SSE chunk'ları.
9. Stream bitince: full response'ta `[PHASE:...]` regex + `[SESSION_END]` marker yakalanır → assistant mesajı kaydedilir → session phase update → SESSION_END varsa `endSessionAction(id, 'ai_ended')`.
10. `endSessionAction`: `status = 'completed'`, `duration_seconds` hesaplanır, `scheduleEvaluationJob(sessionId)` fire-and-forget.
11. QStash 5 sn gecikmeyle `POST /api/sessions/[id]/evaluate` çağırır → imza doğrulama → `runEvaluation` → LLM JSON mode → `evaluations` ve `dimension_scores` INSERT → `awardXPAndBadges`.
12. Kullanıcı ekranda `sessionEnded: true` SSE event'ini görünce rapor sayfasına yönlenir: `/dashboard/sessions/[id]/report` → değerlendirme hazır değilse yükleniyor state'i.

**Dosyalar:** `src/app/(dashboard)/dashboard/sessions/new/page.tsx`, `src/components/sessions/CinematicPersonaStage.tsx`, `src/lib/actions/session.actions.ts`, `src/app/(dashboard)/dashboard/sessions/[id]/page.tsx`, `src/components/sessions/SessionClient.tsx`, `src/app/api/sessions/[id]/chat/route.ts`, `src/lib/session/system-prompt.builder.ts`, `src/lib/session/message.service.ts`, `src/lib/evaluation/evaluation.queue.ts`, `src/app/api/sessions/[id]/evaluate/route.ts`, `src/lib/evaluation/evaluation.engine.ts`, `src/lib/evaluation/gamification.service.ts`.

#### Akış 3: Tenant Admin yeni rozet oluşturma
1. Tenant admin `/tenant/gamification` → `AdminGuard(['tenant_admin','super_admin'])` → server-side `getTenantBadges` + `getTenantChallenges`.
2. `GamificationForms` (client) → form submit `createTenantBadgeAction(formData)` (`src/lib/actions/gamification.actions.ts`).
3. Action: auth + role check → Zod parse (`BadgeSchema`) → Supabase SSR client → `badges` INSERT (sütunlar: `name, description, category, xp_reward, icon, criteria, tenant_id`).
4. **Kanıtlı hata:** orijinal `badges` migration'ı (`20260419110600_009_gamification.sql`) `code TEXT NOT NULL UNIQUE` şartını koyuyor. Schema fix migration'ı (`20260422_021_gamification_schema_fix.sql`) `badge_code` ekledi ama `code`'u KALDIRMADI. Action `code`'u set etmediği için INSERT reddediliyor — Gelistime.md #12 ve Gelistime2.md #8'de raporlanmış. Gelistime4.md'de CRUD aksiyonları eklendi fakat `code` kolonuna değer yazıldığı görünmüyor. Bu hâlâ açık olabilir (kodda çözüm izi yok).
5. `revalidatePath('/tenant/gamification')`.

**Dosyalar:** `src/app/(dashboard)/tenant/gamification/page.tsx`, `src/components/tenant/GamificationForms.tsx`, `src/lib/actions/gamification.actions.ts`, `supabase/migrations/20260419110600_009_gamification.sql`, `supabase/migrations/20260422_021_gamification_schema_fix.sql`.

---

## 4. Downstream Agent'lar İçin Devir Bloğu

### 4.1 Software Architect için (mimari örüntüler, sınırlar, coupling hot-spot'ları)

**Kullanılan örüntüler (kanıtlı):**
- **Adapter pattern** — LLM/STT/TTS için `ILLMAdapter`, `ISTTAdapter(?)`, `ITTSAdapter(?)` arayüzleri. `src/adapters/*/`.
- **Server Actions + Repository-esque queries:** Yazmalar `src/lib/actions/*.actions.ts` ('use server'), okumalar `src/lib/queries/*.queries.ts` plain async. `CLAUDE.md` bunu belgeliyor ve kod onaylıyor.
- **DDD-esque module iskeleti:** `src/modules/{auth,session,persona,scenario,evaluation,gamification,...}` — **yalnızca auth modülü implement edilmiş**; diğerleri boş iskelet.
- **Route Group ile Role Layout:** `(auth)`, `(dashboard)`, `(admin)` (fiilen boş), `(manager)` (fiilen boş).
- **AES-GCM encryption** (`src/lib/encryption/aes-gcm.ts`) — system prompt ve transcript'ler.
- **SSE streaming** — `/api/sessions/[id]/chat`.
- **Queue pattern** — Upstash QStash ile delayed + retried job'lar (evaluate, cron'lar).

**Kanıtlı sınırlar & coupling hot-spot'ları:**
- **`session.actions.ts` ağır:** hem DB kontrolü, hem system prompt üretimi, hem service-role `prompt_logs` yazımı, hem QStash kuyruk çağrısı. `src/modules/session/` klasörü boş — modüler refactoring iskeleti mevcut ama kullanılmamış.
- **İki adapter klasörü (`src/adapters/` vs `src/lib/adapters/`):** STT route.ts `@/lib/adapters/stt.adapter`'ı import ediyor, TTS de `@/lib/adapters/tts.adapter`. Ama chat route.ts `@/adapters/llm`'i import ediyor. **Bölünmüş** adapter katmanı.
- **Role checks çoklu kaynak:** middleware `user_metadata.role`, server action'lar `users.role`. Senkronizasyon garantisi kodda yok.
- **Migrations dual-scheme:** 30+ migration iki ayrı numara şemasında; aynı `022` numarasıyla iki dosya. Tutarlı migration pipeline'ı yok.
- **RLS + service-role dağılımı:** `createServiceRoleClient` şu yerlerde: `session.actions.ts`, `user.actions.ts`, `persona.actions.ts`, `scenario.actions.ts`, `tenant.actions.ts`, `storage.actions.ts`, `evaluation.engine.ts`, `/api/sessions/[id]/evaluate`, `/api/cron/session-timeout`, `/api/cron/assign-weekly-challenges`. Geniş bir RLS-bypass yüzeyi — her çağrı güven gerektirir.
- **UI'de çift kütüphane:** shadcn/ui + Radix + **ek olarak** `@base-ui/react` (kullanım yerleri incelenmedi). Tek kütüphane konsolidasyonu gereksinimi olabilir.

### 4.2 Workflow Architect için (keşfedilen akışlar ve eksik yerler)

**Tamamlanmış akışlar:**
- Email/şifre login + KVKK consent + role-based redirect.
- Yeni seans oluşturma (2 adımlı wizard: persona → senaryo + mod).
- Chat turu (SSE) + system prompt şifreli saklama/çözme.
- Değerlendirme kuyruklama + async skorlama + gamification ödülü.
- 30 dakika inaktivite → `dropped` cron.
- Haftalık görev dağıtımı cron.
- Rapor sayfası (manager/HR).

**Eksik / yarım akışlar (kanıtlı):**
- **Kullanıcı kayıt (sign-up):** Public sign-up sayfası yok. Yeni kullanıcılar yalnızca `/tenant/users` üzerinden `inviteUserAction` ile admin tarafından oluşturuluyor (temp password). Self-serve onboarding yok.
- **E-posta bildirim gönderimi:** Resend paketi kurulu ama hiç import yok; `notifications` tablosu var, `email_sent` flag'i var, ama **e-posta gönderen kod yok**. Akış çalışmıyor.
- **Şifre sıfırlama:** Login sayfasında "Şifremi Unuttum" linki `href="#"` — kod yok.
- **SSO / Google OAuth:** Login sayfasında "SSO ile Giriş" butonu, fonksiyonsuz. `/auth/callback` OAuth code'u bekliyor ama tetikleyen akış yok.
- **Real-time bildirim:** `NotificationPoller` komponenti var (periyodik HTTP poll varsayımı) — Supabase Realtime kullanılmıyor.
- **Voice akışı:** Paketler kurulu (`@ricky0123/vad-web`, `onnxruntime-web`, `elevenlabs`), `VoiceSessionClient` komponenti ve STT route var. TTS route dosyası `api/sessions/[id]/tts/route.ts` içeriği okunmadı. **Uçtan uca voice akışının doğruluğu görülmedi**.
- **`/manager/team`, `/manager/reports`:** PlaceholderPage — manager için ekip yönetimi akışı yok.
- **`/dashboard/progress`, `/dashboard/notifications`:** PlaceholderPage.
- **`/admin/system`:** Middleware'de koruyor ama sayfa yok.
- **Dropped seans recovery UI** var (`DroppedSessionRecovery` komponent) ama `resumeSessionAction` gerçek DB durumu 2 saatten eskiyse reddediyor — kullanıcı yeni seans başlatmak zorunda.
- **QStash cron'ları tetikleyen schedule:** Kodda yok. QStash dashboard'unda manuel kurulmuş olmalı (gözlemlenemez).

### 4.3 Project Shepherd / Sprint Prioritizer için (alan-bazlı olgunluk)

| Alan | Durum | Kanıt |
|---|---|---|
| **Auth (email/password, middleware, role checks)** | **Complete** | `middleware.ts`, `loginAction`, `AdminGuard` çalışır |
| **Auth (sign-up, SSO, password reset, email verify)** | **Missing** | Kod yok; butonlar dummy |
| **RLS** | **Partial** | Policy'ler migration 012'de; ama `022` çoğullaması ve gamification `tenant_id` eklemelerinden sonra policy kaplaması net değil |
| **Supabase data model (core tables)** | **Complete** | 30+ migration; enum + RLS + trigger'lar |
| **Supabase data model (badges/challenges)** | **Partial/Broken** | `code NOT NULL` + `badge_code` ikili sütun; yazma action'ları hâlâ hata verebilir |
| **Session lifecycle (text mode)** | **Complete** | pending/active/completed/dropped/failed geçişleri; timeout cron |
| **Session lifecycle (voice mode)** | **Partial** | STT endpoint var; TTS + VAD + VoiceSessionClient client state var ama uçtan uca test kanıtı yok; ElevenLabs API anahtarı boş |
| **Evaluation pipeline (LLM JSON + QStash)** | **Complete (kod seviyesinde)** | Gerçek çalışma OPENAI key olmadan test edilemez |
| **Gamification (profile, XP)** | **Partial** | service kodu var; badge CRUD formu hata veriyor (kullanıcı notları) |
| **Admin: tenants** | **Complete** | List + create dialog |
| **Admin: users (invite/update/deactivate)** | **Partial** | Invite var; update/deactivate kullanıcı tarafından "Rol güncellenemedi" hatası rapor edildi |
| **Admin: personas + prompt templates + rubrics** | **Partial** | Listeleme/detay var; veri tabanında seed eksik olabilir (boş-state mesajları) |
| **Tenant admin dashboard** | **Complete (iskelet)** | 3 count stat; detay yok |
| **User dashboard (stats + charts)** | **Complete** | Rechart entegre, 9 paralel query |
| **Progress / Notifications / Team** | **Missing (placeholder)** | 4 PlaceholderPage |
| **Reports (manager/HR)** | **Complete** | `/reports` tam, `/reports/users/[userId]` var |
| **Email notifications (transaction/outbound)** | **Missing** | Resend import yok |
| **Realtime** | **Missing** | Supabase realtime kullanılmıyor |
| **Storage (avatars)** | **Partial** | Migration 20260422_023 yazıldı ama Supabase'de manuel çalıştırılması gerekli (Gelistime4.md notu) |
| **Storage (personas)** | **Partial** | Kodda runtime `createBucket` ediliyor — migration yok |
| **Payments / Subscriptions** | **Missing** | Stripe/iyzico vb. yok |
| **Tests** | **Missing** | Vitest/Playwright kurulu, config ve test yok |
| **Observability (logs, metrics)** | **Partial** | `usage_metrics` tablosu, `audit_logs` tablosu var; `src/lib/logger` thin wrapper; Sentry/tracing entegrasyonu yok |
| **Deployment config** | **Partial** | `.next/` build var; Vercel/Docker/CI yapılandırması gözlenmedi |
| **Docs** | **Partial** | CLAUDE.md iyi; README default; `docs/phases/` boş |

### 4.4 DevOps Automator için

**Deployment hedefleri (koda bakarak çıkarılabilecekler):**
- Next.js 16 App Router → Vercel ile uyumlu (öntanımlı). `maxDuration = 30` STT route'unda Vercel function timeout'u olarak set edilmiş — **Vercel varsayımı güçlü**.
- `next.config.ts` image remote pattern'ı tek hardcoded host: `dqmivckxqdvwlzudshlz.supabase.co`. Multi-env için env-driven olmalı.
- Vercel/Railway/Fly gibi bir platformda CRON scheduler YOK; QStash cron route'ları var ama QStash dashboard'unda manuel schedule olmak zorunda.

**Supabase proje referansı:**
- URL (`.env.local`): `https://dqmivckxqdvwlzudshlz.supabase.co`
- **Guardrail:** Hardcoded `next.config.ts`'de aynı URL. Yeni ortamda config değişmeli.
- Anahtar ve service-role key `.env.local`'da gerçek — **bu dosya git repo'suna girmemeli** (`.gitignore`'da olmalı; doğrulanmadı).

**Deploy öncesi kanıtlı blocker'lar:**
1. `.env.local`'da `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `QSTASH_TOKEN`, `RESEND_API_KEY`, `ELEVENLABS_DEFAULT_VOICE_ID` **boş**. Prod'da doldurulmalı.
2. Kod `UPSTASH_QSTASH_TOKEN`, `UPSTASH_QSTASH_CURRENT_SIGNING_KEY`, `UPSTASH_QSTASH_NEXT_SIGNING_KEY`, `QSTASH_RECEIVER_URL` bekliyor ama `.env.local.example` sadece `QSTASH_TOKEN`/`QSTASH_URL` tanımlıyor. **Kod ↔ doc uyumsuzluğu**; deploy runbook'unda gerçek isimler yer almalı.
3. Migration uygulama sırası belirsiz: plain-numeric (014-022) ile timestamp'li migration'lar karışık. Idempotency kısmen korunmuş (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`) ama `CREATE TABLE` statement'ları idempotent değil. Temiz bir Supabase projesine sıfırdan uygulanırken çakışma olabilir.
4. `storage.buckets` için `avatars` migration yazılmış (Gelistime4.md'de "SQL Editor'da çalıştırılması gerekiyor" notu); `personas` bucket'ı hiç migration'ı olmadan **kod runtime'da yaratıyor** — deploy öncesi `avatars` migration'ı manuel çalıştırılmalı.
5. QStash cron schedule'ı dashboard tarafında kurulmalı: `POST /api/cron/session-timeout` (her 30 dk), `POST /api/cron/assign-weekly-challenges` (her Pazartesi 00:00 UTC).
6. `npm run build` sonucu gözlemlenmedi; TypeScript strict + Next 16 + React 19 kombosu var. Build doğrulaması runbook'un parçası olmalı.
7. Test setup'ı eksik — CI'de test aşaması koyulamaz.

**Güvenlik/RLS boşlukları (kanıtlı, spekülasyon yok):**
- `user_metadata.role` ve `user_metadata.tenant_id` **JWT içinde** — bunlar `auth_tenant_id()`, `auth_role()` fonksiyonlarının ve middleware'in tek gerçek kaynağı. Supabase admin API'den `createUser({ user_metadata })` çağrılırken manuel set ediliyor (`bootstrap-users.mjs`, `inviteUserAction`). `users.role` sütunu ile senkron kalmadığında yetkilendirme hatalı sonuç verir.
- `badges` ve `challenges` tablolarında `INSERT` policy'si `tenant_id = auth_tenant_id()` AND rol kontrolü; ama `tenant_id` sütununun NULL olduğu global kayıtlar için yazma kuralı tanımlı değil. Global seed'ler yalnızca service-role ile girilebilir.
- `storage.actions.ts::uploadPersonaImageAction` service-role ile bucket'ı runtime'da yaratıyor. Prod'da ilk çağrı bucket yoksa race condition yaratabilir (kanıt: `if (!personasBucket) await supabase.storage.createBucket(...)`).
- `src/lib/supabase/client.ts` anonim client oluşturuyor ama tek bir yerde mi kullanıldığı (browser context) doğrulanmadı — yanlışlıkla server bundle'a dahil olursa anon key gereksiz sızıntı olmaz (public zaten) fakat pattern temiz değil.

### 4.5 İnsan Tarafından Açıklığa Kavuşturulması Gereken Açık Sorular

1. **Migration uygulama sırası:** Supabase hosted projesinde hangi migration'lar zaten uygulanmış durumda? Şu an DB şemasının kod beklentisiyle eşleştiği test edilmiş mi?
2. **`badges.code` ve `badges.badge_code` ikili durumu:** Yeni satır insert'leri hangi kolona yazılacak? Eski `code NOT NULL` kısıtı hâlâ aktif mi? (Gelistime3.md #5 güncel mi yoksa çözüldü mü?)
3. **`user_metadata` ile `users` tablosu senkronizasyonu:** Rol veya tenant değişince JWT güncelleniyor mu? (Force re-login gerekli mi?)
4. **QStash cron'ları:** `session-timeout` ve `assign-weekly-challenges` QStash dashboard'undan schedule edildi mi, yoksa hiç tetiklenmiyor mu?
5. **`NotificationPoller`:** Client hangi endpoint'i poll ediyor? (Content okunmadı — olası eksik endpoint varsa Workflow Architect önceliklendirmeli.)
6. **Voice akışı fiili durum:** ElevenLabs TTS endpoint'i çalışır halde mi? `FEATURE_VOICE_ENABLED` bir yerde okunuyor mu? (Gözlemlenmedi.)
7. **Deployment hedefi:** Vercel mi, başka bir host mu? CI/CD (GitHub Actions vb.) yapılandırması istiyor musunuz?
8. **Çok ortamlı Supabase:** Staging/prod ayrı proje mi? `next.config.ts` host hardcoded.
9. **Ödeme/abonelik:** Bu SaaS için billing modeli planı var mı? Şu anda koda hiçbir ödeme entegrasyonu yok.
10. **`Gelistime*.md` önceliklendirme:** Bu TR bug listeleri hangisi hâlâ açık, hangisi kapandı? Gelistime4.md kısmen kapatılanları işaretliyor ama öncekiler için bir durum yok.
11. **Test stratejisi:** Vitest/Playwright kuruldu; nereye başlayalım? (Auth, session, evaluation öncelikli mi?)
12. **Sign-up akışı:** Self-serve sign-up istiyor musunuz, yoksa davet-tabanlı kalacak mı?
13. **`src/app/dashboard/`, `src/app/manager/`, `src/app/\(dashboard\)/`:** Bu boş/artık klasörler silinebilir mi?
14. **Boş `src/modules/*`:** Planlanan refactoring iskeletleri mi, yoksa temizlenmeli mi?
15. **Resend paketi:** E-posta gönderimi v1 scope'unda mı?

---

## 5. İncelenen Dosyalar (tam liste)

Okunan (tam veya kısmi):
- `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `components.json`
- `middleware.ts`
- `.env.local`, `.env.local.example`
- `README.md`, `CLAUDE.md`, `AGENTS.md`, `Gelistime.md`, `Gelistime2.md`, `Gelistime3.md`, `Gelistime4.md`
- `src/app/layout.tsx`
- `src/app/(auth)/layout.tsx`, `(auth)/login/page.tsx`, `(auth)/consent/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`, `dashboard/sessions/page.tsx`, `dashboard/sessions/new/page.tsx`, `dashboard/sessions/[id]/page.tsx`, `dashboard/sessions/[id]/report/page.tsx`, `dashboard/profile/page.tsx`
- `src/app/(dashboard)/admin/layout.tsx`, `admin/page.tsx`, `admin/tenants/page.tsx`, `admin/personas/page.tsx`, `admin/prompts/page.tsx`, `admin/rubrics/page.tsx`
- `src/app/(dashboard)/tenant/layout.tsx`, `tenant/page.tsx`, `tenant/personas/page.tsx`, `tenant/scenarios/page.tsx`, `tenant/users/page.tsx`, `tenant/gamification/page.tsx`
- `src/app/(dashboard)/reports/page.tsx`
- `src/app/(dashboard)/sessions/new/page.tsx` (eski)
- `src/app/api/health/route.ts`, `api/sessions/[id]/chat/route.ts`, `api/sessions/[id]/evaluate/route.ts`, `api/sessions/[id]/heartbeat/route.ts`, `api/sessions/[id]/stt/route.ts`, `api/cron/session-timeout/route.ts`, `api/cron/assign-weekly-challenges/route.ts`
- `src/components/common/placeholder-page.tsx`, `admin/AdminGuard.tsx`
- `src/lib/auth.ts`, `lib/navigation.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/supabase/client.ts`
- `src/lib/actions/session.actions.ts`, `lib/actions/user.actions.ts`, `lib/actions/gamification.actions.ts`, `lib/actions/storage.actions.ts`
- `src/lib/evaluation/evaluation.engine.ts`, `lib/evaluation/evaluation.queue.ts`
- `src/lib/encryption/aes-gcm.ts`
- `src/lib/session/system-prompt.builder.ts`
- `src/adapters/llm/interface.ts`, `adapters/llm/openai.adapter.ts`
- `src/modules/auth/actions.ts`, `modules/auth/service.ts`
- `src/stores/session.store.ts`
- `src/types/index.ts`
- `scripts/bootstrap-users.mjs`
- `supabase/migrations/20260419102854_001_tenants_and_roles.sql`, `002_rls_policies.sql`, kısmi olarak `003_persona_system.sql`, `006_scenarios.sql`, `007_session_system.sql`, `008_evaluation_system.sql`, `009_gamification.sql`, `011_admin_compliance.sql`, `012_rls_all_tables.sql`, `20260422_021_gamification_schema_fix.sql`, `20260422_022_sessions_session_mode.sql`, `20260422_023_storage_avatars_bucket.sql`

İncelenmedi (kasten, zaman kısıtı):
- `src/app/api/sessions/[id]/drop/route.ts` (var, içerik okunmadı)
- `src/app/api/sessions/[id]/tts/route.ts` (var, içerik okunmadı)
- `src/adapters/stt/openai.adapter.ts`, `src/adapters/tts/elevenlabs.adapter.ts` (içerik okunmadı)
- `src/lib/adapters/stt.adapter.ts`, `src/lib/adapters/tts.adapter.ts` (içerik okunmadı)
- `src/components/sessions/SessionClient.tsx`, `VoiceSessionClient.tsx`, `CinematicPersonaStage.tsx`, `DroppedSessionRecovery.tsx` (varlıkları doğrulandı, iç kod okunmadı)
- `src/components/layout/app-sidebar.tsx`, `app-header.tsx`, `mobile-nav.tsx` (varlık + navigation.ts'den kullanımları biliniyor)
- `src/components/common/NotificationPoller.tsx` (akış doğrulanmadı)
- `src/components/tenant/GamificationForms.tsx` ve `GamificationLists.tsx` (varlık)
- Çoğu rapor komponenti, admin komponenti (PersonaForm, TenantTable, UserTable vb.)
- Migration'ların hepsinin tam içeriği (tek tek her tablo sütunu değil, sadece örüntü)
- `supabase/seed/dev_seed.sql`, `supabase/seed/README.md`
- `src/app/globals.css` (theme token'ları, ama genel Tailwind v4 + shadcn)
- `src/hooks/*` hook'larının hepsi (ad + listelendi)
- `src/lib/logger/`, `src/lib/utils/`, `src/lib/queries/*` dosyalarının detay içeriği
- `src/reducers/session.reducer.ts`
- `src/stores/voice-session.store.ts` (ad doğrulandı)

---

## Güncelleme — 2026-04-23 Akşamı

### Yeni Gözlem: Profil Güncelleme `user` Rolünde Çalışmıyor

Onboarding belgesi profil sayfalarının varlığını tespit etmişti ancak rol-bazlı davranışları canlı test etmemişti. Kullanıcı 2026-04-23 akşamında canlı testle şunu doğruladı:

- **Tenant Admin profili:** Fotoğraf yükleme + input güncelleme **çalışıyor** (`Gelistime4Kontrol.md` Item #2)
- **Standart `user` rolünde profil:** Fotoğraf yüklenmiyor (`Bucket not found` veya RLS hatası), input güncelleme hatası (`Profil güncellenemedi.`)

Onboarding belgesi bu farklılığı kodda tespit edemezdi çünkü UI'ın aynı bileşeni her iki rol için de render ediyor; ayrım RLS / policy katmanında.

Olası kaynaklar (kodun iç analizi yapılmadı, **hipotez** — Builder doğrulamalı):
- `supabase/migrations/20260422_023_storage_avatars_bucket.sql` policy'leri tenant_admin'e göre yazılmış olabilir
- `public.users` UPDATE RLS policy'si `auth.uid() = id` self-update koşulunu eksik taşıyor olabilir

**Sınıflandırma:** Bu yeni bir akış değil, mevcut akışın bir rol permutasyonunda hatalı olduğunun kanıtı. Phase 0 P0 bug olarak `mimari_kararlar_20260423.md` ve `akis_haritasi_20260423.md`'ye de işlendi.

### Dev Server Sorunu (Bilgilendirme)

Onboarding belgesi yazıldığı sırada bilinmiyordu ama kullanıcı dev server'ı çalıştıramadı. Sebep: `/Users/ozcanbalioglu/projeler/` klasöründe (bu projenin üstündeki klasörde) kaza eseri `package.json`, `package-lock.json` ve `node_modules/` bulunuyordu (2026-04-19'da yanlış dizinde `npm install` çalıştırılmış). Turbopack çift lockfile gördü, üstteki lockfile'ı workspace root olarak seçti, `tailwindcss` modülünü yanlış yerde aradı.

**Çözümler (2026-04-23 akşamı uygulandı):**
1. `/Users/ozcanbalioglu/projeler/{package.json,package-lock.json,node_modules/}` silindi (432 MB)
2. `.next/` cache'i temizlendi
3. `next.config.ts`'e explicit `turbopack.root: path.resolve(__dirname)` eklendi (re-emergence önleyici)

Onboarding belgesi §İncelenen Dosyalar kısmında `next.config.ts` referansı mevcut; yeni hâli de tutarlı.
