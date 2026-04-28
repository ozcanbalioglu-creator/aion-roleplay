# AION Mirror — Production Deploy Runbook

Bu doküman, ilk production deployment ve sonraki güncellemeler için adım adım prosedürü kapsar.

---

## Gereksinimler (Prerequisite)

- Node.js 22+
- `npm ci` temiz çalışıyor
- `npm run lint` → 0 error
- `npm run typecheck` → 0 error
- `npm test` → tüm testler yeşil
- `npm run verify-migrations` → PASS
- `npm run build` → başarılı

---

## 1. Servis Hesapları

Her servis için hesap ve API anahtarları hazırlanır:

| Servis | Kullanım | URL |
|---|---|---|
| Supabase | Veritabanı + Auth + Storage | supabase.com |
| Upstash QStash | Evaluation / summarize / dev-plan kuyruğu | console.upstash.com |
| Upstash Redis | OTP rate limiting | console.upstash.com |
| OpenAI | LLM (chat + evaluate) + Whisper STT | platform.openai.com |
| ElevenLabs | TTS (persona sesleri + debrief koçu) | elevenlabs.io |
| Resend | Transactional e-posta (OTP + davet) | resend.com |
| Vercel | Uygulama hosting | vercel.com |

---

## 2. Supabase Kurulumu

### 2.1 Yeni Proje Oluştur

1. Supabase Dashboard → **New Project**
2. Bölge: `eu-central-1` (Frankfurt) — Türk kullanıcılar için en yakın
3. Veritabanı şifresi not edilir (migration'larda kullanılmaz ama güvenli yerde saklanır)
4. Proje oluşturulduktan sonra:
   - **Settings → API** → `Project URL` ve `anon public` ve `service_role` anahtarlarını kopyala

### 2.2 Auth Ayarları

**Settings → Authentication → Email:**
- Enable email confirmations: **ON**
- Secure email change: **ON**

**Settings → Authentication → SMTP:**
```
SMTP Host:     smtp.resend.com
Port:          465
User:          resend
Password:      <RESEND_API_KEY>
Sender email:  noreply@mirror.aionmore.com
Sender name:   AION Mirror
```

**Settings → Authentication → URL Configuration:**
```
Site URL:              https://your-domain.com
Redirect URLs ekle:    https://your-domain.com/auth/callback
```

### 2.3 Storage Bucket'ları

SQL Editor'da çalıştır (migration'lar bunları oluşturuyor, yoksa manuel):

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('tenants', 'tenants', true),
       ('report-audio', 'report-audio', false)
ON CONFLICT (id) DO NOTHING;
```

### 2.4 Migration'ları Uygula

Supabase SQL Editor'da **sırayla** çalıştır (her birini ayrı ayrı):

#### Grup 1 — Temel Şema (001–013)
```
20260419102854_001_tenants_and_roles.sql
20260419103334_002_rls_policies.sql
20260419110000_003_persona_system.sql
20260419110100_004_prompt_templates.sql
20260419110200_005_rubric_system.sql
20260419110300_006_scenarios.sql
20260419110400_007_session_system.sql
20260419110500_008_evaluation_system.sql
20260419110600_009_gamification.sql
20260419110700_010_observability.sql
20260419110800_011_admin_compliance.sql
20260419110900_012_rls_all_tables.sql
20260419111000_013_views_and_seed.sql
```

#### Grup 2 — Eski format (014–022, alfabetik sıra)
```
014_session_activity.sql
015_gamification_seed.sql
016_persona_expansion.sql
017_add_persona_location.sql
018_manager_reporting.sql
019_tenant_website_url.sql
021_persona_tenant_mapping.sql
022_fix_persona_tenant_rls.sql
022_update_rls_manager_access.sql
```

#### Grup 3 — Yeni format (014+, timestamp prefix)
```
20260420000001_014_users_profile_fields.sql
20260421_017_persona_fields_expansion.sql
20260421_018_scenarios_align.sql
20260421_019_scenario_seed.sql
20260421_020_scenario_mood_hint.sql
20260422_021_gamification_schema_fix.sql
20260422_022_sessions_session_mode.sql
20260422_023_storage_avatars_bucket.sql
20260424_024_badges_schema_unification.sql
20260424_025_users_self_update_rls.sql
20260424_026_rubric_dimensions_fields.sql
20260424_027_tenants_rubric_template.sql
20260424_028_fix_users_self_update_rls.sql
20260425_030_persona_name_unification.sql
20260425_031_icf_rubric_seed.sql
20260425_032_persona_voice_id.sql
20260425_033_session_summaries.sql
20260425_034_debrief_schema.sql
20260425_035_persona_prompt_feedback.sql
20260425_036_report_audio.sql
20260425_037_user_development_plans.sql
20260425_038_cancellation_schema.sql
20260425_039_notifications.sql
20260425_040_evaluation_failed_status.sql
20260425_041_context_enrichment.sql
```

> **Not:** Her migration idempotent yazılmıştır (`IF NOT EXISTS`, `OR REPLACE`). Yeniden çalıştırmak güvenlidir.

---

## 3. Resend Domain Setup

1. Resend Dashboard → **Domains → Add Domain**
2. Domain: `mirror.aionmore.com`
3. Resend'in verdiği DNS kayıtlarını domain sağlayıcına ekle (MX, TXT, CNAME)
4. Doğrulama tamamlanana kadar bekle (genellikle 5–15 dk)
5. Verified göründüğünde Supabase SMTP'ye `RESEND_API_KEY` ekle (§2.2)

---

## 4. Upstash Kurulumu

### 4.1 QStash

1. console.upstash.com → **QStash → Create**
2. Dashboard'dan kopyala:
   - `QSTASH_TOKEN` → `UPSTASH_QSTASH_TOKEN`
   - `CURRENT_SIGNING_KEY` → `UPSTASH_QSTASH_CURRENT_SIGNING_KEY`
   - `NEXT_SIGNING_KEY` → `UPSTASH_QSTASH_NEXT_SIGNING_KEY`

### 4.2 Redis (OTP Rate Limiting)

1. console.upstash.com → **Redis → Create Database**
2. Bölge: `eu-west-1` (Dublin) veya `eu-central-1`
3. Dashboard → **REST API** sekmesinden kopyala:
   - `REST URL` → `UPSTASH_REDIS_REST_URL`
   - `REST Token` → `UPSTASH_REDIS_REST_TOKEN`

---

## 5. ElevenLabs Voice ID'leri

1. elevenlabs.io → **Voice Library** → istenen sesleri bul veya **Add Voice** ile klonla
2. Her persona için voice ID'yi `personas` tablosundaki `voice_id` kolonuna yaz:
   ```sql
   UPDATE personas SET voice_id = 'abc123...' WHERE name = 'Murat Kaya';
   ```
3. Debrief koçu için ayrı bir ses seç → ID'yi `ELEVENLABS_DEBRIEF_COACH_VOICE_ID` env'ine ekle
4. Fallback: `ELEVENLABS_DEFAULT_VOICE_ID` — herhangi bir genel ses

---

## 6. Encryption Key Üret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Çıktı 64 karakterlik hex string → `ENCRYPTION_KEY`

> **Kritik:** Bu key değiştirilirse DB'deki tüm şifreli sistem promptları okunamaz olur. Güvenli bir kasada sakla.

---

## 7. Vercel Deployment

### 7.1 Proje Bağla

```bash
npm install -g vercel
vercel login
vercel link   # mevcut projeye bağla ya da yeni oluştur
```

### 7.2 Environment Variables

Vercel Dashboard → **Settings → Environment Variables** (veya `vercel env add`):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL          = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJ...
SUPABASE_SERVICE_ROLE_KEY         = eyJ...

# Encryption
ENCRYPTION_KEY                    = <64-char hex>

# LLM
LLM_PROVIDER                      = openai
OPENAI_API_KEY                    = sk-...
OPENAI_LLM_MODEL                  = gpt-4o

# STT
STT_PROVIDER                      = openai

# TTS
TTS_PROVIDER                      = elevenlabs
ELEVENLABS_API_KEY                = ...
ELEVENLABS_DEFAULT_VOICE_ID       = ...
ELEVENLABS_DEBRIEF_COACH_VOICE_ID = ...

# QStash
UPSTASH_QSTASH_TOKEN              = ...
UPSTASH_QSTASH_CURRENT_SIGNING_KEY = ...
UPSTASH_QSTASH_NEXT_SIGNING_KEY   = ...
QSTASH_RECEIVER_URL               = https://your-domain.com

# Redis
UPSTASH_REDIS_REST_URL            = https://...upstash.io
UPSTASH_REDIS_REST_TOKEN          = ...

# Email
RESEND_API_KEY                    = re_...

# App
NEXT_PUBLIC_APP_URL               = https://your-domain.com
APP_ENV                           = production

# Feature Flags
FEATURE_VOICE_ENABLED             = true
FEATURE_GAMIFICATION_ENABLED      = true
FEATURE_ANALYTICS_ENABLED         = true
FEATURE_BULK_UPLOAD_ENABLED       = true
FEATURE_PROGRESS_PAGE_ENABLED     = true
FEATURE_NOTIFICATIONS_PAGE_ENABLED = true
FEATURE_MANAGER_PAGES_ENABLED     = true
```

### 7.3 Deploy

```bash
vercel --prod
```

veya GitHub entegrasyonuyla main branch push → otomatik deploy.

---

## 8. QStash Cron Schedule

Deploy sonrası QStash Dashboard → **Schedules → Create** ile aşağıdaki cron'ları ekle:

> **Önemli:** `assign-weekly-challenges` artık GÜNLÜK çalışmalı.
> Route kendi içinde "bugün Pazartesi mi?" (haftalık atama) ve "ayın 1'i mi?" (aylık atama) kontrolünü yapıyor.
> Sadece Pazartesi çalıştırılırsa aylık görevler ayın 1'i Pazartesi'ye denk gelmediği sürece atanmaz.

### 1. Görev Atama (Haftalık + Aylık)
```
URL:      https://your-domain.com/api/cron/assign-weekly-challenges
Schedule: 0 8 * * *    (her gün 08:00 UTC)
Method:   POST
Headers:  Authorization: Bearer <UPSTASH_QSTASH_TOKEN>
```
- Pazartesi → Haftalık görevleri tüm aktif kullanıcılara atar (1 zorunlu + 2 rastgele)
- Ayın 1'i → Aylık görevleri atar
- Diğer günler → Erken çıkar, işlem yapmaz

### 2. Görev Hatırlatma
```
URL:      https://your-domain.com/api/cron/challenge-reminders
Schedule: 0 9 * * *    (her gün 09:00 UTC)
Method:   POST
Headers:  Authorization: Bearer <UPSTASH_QSTASH_TOKEN>
```
- Haftalık görevlerde süresi ≤ 2 gün kalanlar için bildirim gönderir
- Aylık görevlerde süresi ≤ 5 gün kalanlar için bildirim gönderir
- Tekrar gönderimi engeller (`reminder_sent_at` kontrolü)

### 3. Seans Timeout Temizleme
```
URL:      https://your-domain.com/api/cron/session-timeout
Schedule: */15 * * * *  (her 15 dakikada bir)
Method:   POST
Headers:  Authorization: Bearer <UPSTASH_QSTASH_TOKEN>
```

---

## 8a. XP Çarpan Sistemi (Kullanıcıya Şeffaf)

Seans tamamlandığında kazanılan XP, **persona** ve **senaryo** zorluk derecesine göre otomatik artar.
Çarpan detayı her kullanıcının XP geçmişinde (point_transactions) kayıtlıdır.

| Persona Zorluğu | Çarpan |
|---|---|
| 1 (En Kolay) | ×1.00 |
| 2 | ×1.15 |
| 3 | ×1.30 |
| 4 | ×1.50 |
| 5 (En Zor) | ×2.00 |

| Senaryo Zorluğu | Çarpan |
|---|---|
| 1 (En Kolay) | ×1.00 |
| 2 | ×1.10 |
| 3 | ×1.20 |
| 4 | ×1.35 |
| 5 (En Zor) | ×1.60 |

**Çarpanlar çarpılır.** Örnek: Zorluk 4 persona + Zorluk 5 senaryo → ×1.50 × ×1.60 = **×2.40 toplam**

Bu bilgi Tenant Onboarding kitabına da eklenecek (bkz. Onboarding kitabı notu).

---

## 9. İlk Super Admin Oluştur

Migration'lar çalıştıktan sonra, Supabase SQL Editor:

```sql
-- 1. Tenant oluştur (super_admin'in tenant'ı)
INSERT INTO tenants (name, slug, is_active)
VALUES ('AION Platform', 'aion-platform', true)
RETURNING id;

-- 2. auth.users'a ekle (Authentication → Users → Invite User)
-- E-posta gönderdikten sonra kullanıcı ID'sini al:

-- 3. Rolü super_admin yap
UPDATE users
SET role = 'super_admin', tenant_id = '<tenant_id_from_step_1>'
WHERE email = 'admin@yourdomain.com';
```

---

## 10. Post-Deploy Doğrulama

```
[ ] https://your-domain.com/api/health  → 200, tüm servisler "set"
[ ] /login sayfası yükleniyor
[ ] E-posta ile OTP login çalışıyor (gerçek test hesabı)
[ ] Super admin /admin/tenants'tan yeni tenant oluşturabiliyor
[ ] Bulk upload (CSV/XLSX) başarılı — invite e-postası gidiyor
[ ] Yeni kullanıcı magic link ile ilk girişi yapabiliyor
[ ] Seans başlatma → persona "Merhaba" diyor (ElevenLabs TTS çalışıyor)
[ ] STT → konuşma transkripsiyona dönüşüyor
[ ] Seans bitiminde evaluation queue'ya giriyor (QStash log'da görünüyor)
[ ] Değerlendirme raporu oluşuyor (evaluation complete)
[ ] Sesli rapor MP3 Supabase Storage'da oluşuyor
[ ] /admin/system sayfasında tüm servisler yeşil
```

---

## 11. Feature Flag Matrisi

| Flag | Geliştirme | Staging | Production |
|---|---|---|---|
| `FEATURE_VOICE_ENABLED` | true | true | true |
| `FEATURE_GAMIFICATION_ENABLED` | true | true | true |
| `FEATURE_ANALYTICS_ENABLED` | true | true | true |
| `FEATURE_BULK_UPLOAD_ENABLED` | true | true | true |
| `FEATURE_PROGRESS_PAGE_ENABLED` | true | true | true |
| `FEATURE_NOTIFICATIONS_PAGE_ENABLED` | true | true | true |
| `FEATURE_MANAGER_PAGES_ENABLED` | true | true | true |

CI ortamında tüm flag'ler `false` (harici servis bağımlılığı yok).

---

## 12. Yeni Migration Deploy Prosedürü

Kod değişikliği + yeni migration birlikte geldiğinde:

```
1. npm run verify-migrations   # PASS olmadan devam etme
2. git push → Vercel deploy başlar
3. Deploy tamamlanmadan ÖNCE migration'ı Supabase SQL Editor'da çalıştır
   (app eski şemayı okurken migration uygulanır — additive değişiklikler güvenli)
4. Vercel deploy tamamlanır
5. /api/health endpoint'ini kontrol et
```

> **Dikkat:** Destructive migration (kolon silme, tip değiştirme) varsa önce yeni kod deploy edilmeli, eski kod yeni şemayla uyumlu olmalı. Gerekirse çift-deploy stratejisi uygula.

---

## 13. Rollback Prosedürü

### Uygulama Rollback (Vercel)

```bash
vercel rollback   # bir önceki deployment'a döner
# veya Vercel Dashboard → Deployments → önceki → Promote to Production
```

### Veritabanı Rollback

Supabase SQL Editor'da ilgili migration'ın tersini çalıştır. Her migration için tersine alma komutu:

```sql
-- Örnek: 041_context_enrichment.sql geri alma
ALTER TABLE tenants DROP COLUMN IF EXISTS context_profile;
ALTER TABLE scenarios DROP COLUMN IF EXISTS role_context;
```

> Additive migration'lar (kolon ekle) kolayca geri alınır. Data migration içerenler için önce yedek al.

### Encryption Key Dönüşümü (Acil)

Key açığa çıktıysa:
1. Yeni key üret
2. Tüm `prompt_logs` satırlarını eski key ile decrypt, yeni key ile re-encrypt et (tek seferlik script)
3. Vercel'de `ENCRYPTION_KEY` env'ini güncelle → yeni deployment

---

## 14. Orphan Auth User Temizleme

Bulk upload sırasında auth kullanıcısı oluştu ancak `public.users` profile oluşmadıysa:

```sql
-- Orphan tespiti (haftalık çalıştır)
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
  AND au.created_at < now() - interval '1 hour';

-- Temizleme (auth.users'dan sil — cascade ile her şeyi temizler)
-- Önce listeyi doğrula, sonra:
DELETE FROM auth.users WHERE id IN ('<uuid1>', '<uuid2>');
```

---

## 15. Monitoring

- **Uptime:** `/api/health` endpoint'ini harici uptime servisi (Uptime Robot / BetterStack) ile izle
- **QStash hataları:** console.upstash.com → QStash → Dead Letter Queue
- **Supabase log'ları:** Supabase Dashboard → Logs → API / Auth / Database
- **Vercel log'ları:** Vercel Dashboard → Deployments → Functions → Runtime Logs
- **Evaluation failure:** `evaluations` tablosunda `status = 'evaluation_failed'` satırları haftalık kontrol
