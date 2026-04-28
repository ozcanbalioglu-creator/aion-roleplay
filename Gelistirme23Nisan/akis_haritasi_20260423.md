# Akış Haritası — roleplay-saas
> Tarih: 2026-04-23
> Önceki belgeler: `system_analiz_20260423.md`, `mimari_kararlar_20260423.md`, `Gelistime4Kontrol.md`
> Sonraki belge: Project Shepherd tarafından yol haritası yazılacak

---

## 1. Executive Summary

**Haritalanan akış sayısı:** 6

| Kategori | Sayı |
|---|---|
| Yeni spec (mevcut kod yok / tamamen sıfırdan) | 2 — Bulk CSV/XLSX Upload, First-Login Password-Change Enforcement |
| Gap-closure (mevcut kısmi kod → spec'e yükseltme) | 4 — Badge/Challenge Lifecycle, Invite-Only Onboarding, Role Resolution, Evaluation Pipeline |

**En riskli 3 akış:**

1. **Badge / Weekly Task Lifecycle** — Gelistime4Kontrol.md Item #1'de canlı olarak doğrulandı: silme onaylandıktan sonra kayıt ekranda kalmaya devam ediyor; toggle state değişmiyor; update çalışmıyor. ADR-002 uygulanmadan bu akışın hiçbir yazma kolu güvenilir değil. En yüksek kullanıcı görünürlüğüne sahip aktif bug.
2. **Bulk CSV/XLSX Upload** — Tamamen yeni feature; Supabase `auth.admin.createUser` + `public.users` INSERT + rol ataması üç ayrı sistem katmanında gerçekleşiyor ve bunlar arasında Postgres transaction yok. Kısmi başarı senaryosu (ilk 8 satır başarılı, 9. hata verdi) açık kalırsa orphan auth kullanıcıları oluşur.
3. **Role Resolution (ADR-008)** — Middleware JWT `user_metadata.role` ile server action `users.role` senkron değil; bir rol değişikliği anında yanlış route izni verebilir. Güvenlik ve UX doğruluk riskini birlikte taşıyor.

**ADR bağımlılık özeti:**

| ADR | Bitmeden çalışmayan akış |
|---|---|
| ADR-001 (QStash env isimleri) | Akış 6 — Evaluation Pipeline (tam çalışmaz) |
| ADR-002 (badge `code` unification) | Akış 1 — Badge/Challenge Lifecycle (create/update kırık) |
| ADR-008 (role single source of truth) | Akış 3 — Invite-Only Onboarding (role sync eksik); Akış 5 — Role Resolution (güvensiz) |

---

## 2. Akış Kayıt Listesi (Registry)

| # | Akış | Spec bölümü | Durum | Trigger | Primary actor | ADR bağımlılığı | Kod gap durumu |
|---|---|---|---|---|---|---|---|
| 1 | Badge / Weekly Task Lifecycle (CRUD) | 3.1 | Draft | Tenant admin UI action | `gamification.actions.ts` | ADR-002 (P0) | Partial — CRUD action'ları eklendi ama `code` kolonu set edilmiyor; delete UI bug aktif |
| 2 | Bulk User Upload (CSV/XLSX) | 3.2 | Missing | Tenant admin CSV/XLSX yükleme | Yeni API route + server action | — | Missing — hiç kod yok |
| 3 | Invite-Only Onboarding (tekli davet) | 3.3 | Draft | Tenant admin "Kullanıcı Davet Et" | `user.actions.ts::inviteUserAction` | ADR-008 (P0) | Partial — inviteUserAction var; role sync eksik; password_must_change flag yok |
| 4 | First-Login Password-Change Enforcement | 3.4 | Missing | İlk oturum açma (davetli veya bulk) | Middleware / layout guard | ADR-008 (dolaylı) | Missing — `password_must_change` kolonu yok; middleware guard yok |
| 5 | Role Resolution | 3.5 | Draft | Rol yazma (invite, update, bulk) | `role-sync.ts` (ADR-008 hedefi) | ADR-008 (P0) | Partial — iki kaynaklı durum; sync helper yok |
| 6 | Evaluation Pipeline (QStash) | 3.6 | Draft | `endSessionAction` → QStash publish | `evaluation.queue.ts`, `evaluate/route.ts` | ADR-001 (P0) | Partial — kod tamam; env isimleri yanlış (deploy blocker) |

---

## 3. Akış Spesifikasyonları

---

### 3.1 Badge / Weekly Task Lifecycle (CRUD)

**Trigger:** Tenant admin `/tenant/gamification` sayfasında form gönderir veya aksiyon butonlarına (toggle/sil) tıklar.

**Aktörler:**
- Tenant admin (UI)
- `GamificationForms.tsx` / `GamificationLists.tsx` (client component)
- `gamification.actions.ts` server action'ları
- Supabase SSR client (`badges`, `challenges` tabloları)
- `revalidatePath` (Next.js cache invalidation)

**Precondition'lar:**
- Kullanıcı `tenant_admin` veya `super_admin` rolünde, kimliği doğrulanmış.
- ADR-002 uygulanmış: `badges.code NOT NULL UNIQUE` tek kolon, `badge_code` kaldırılmış; `challenges.name` nullable veya `title` birincil kolon.
- `badges.tenant_id` RLS policy'si `auth_tenant_id()` ile eşleşiyor.

**ADR bağımlılığı:** ADR-002 (P0 — bu olmadan create/update kırık)

**Kod gap durumu:** Partial
- Eksik: `code` field'ı `createTenantBadgeAction`'da set edilmiyor (ADR-002'nin adım 3-4'ü bu gap'i kapatır).
- Eksik: `toggleBadgeStatusAction` UI state'i yenilemeden dönüyor; `revalidatePath` var ama client'taki optimistic state ile çakışıyor — net hata.
- Eksik: `deleteBadgeAction` sonrası UI kaydı ekrandan kaldırmıyor (Gelistime4Kontrol.md Item #1 canlı kanıt).
- Var: `toggleBadgeStatusAction`, `deleteBadgeAction`, `toggleChallengeStatusAction`, `deleteChallengeAction` Gelistime4.md'de eklendi.

---

#### 3.1.A — Badge Oluşturma (Create)

**Happy Path:**
1. Tenant admin "Yeni Rozet Ekle" formunu açar; alanları doldurur: `name`, `description`, `category` (badge_category enum), `xp_reward` (integer), `icon` (string/emoji), `criteria` (JSONB — koşullar), `code` (slug, tenant içinde unique).
2. Form submit → `createTenantBadgeAction(formData)` çağrılır.
3. Server action: `getCurrentUser()` ile auth + rol doğrulama.
4. Zod şeması (`BadgeSchema`) parse: zorunlu alanlar, `code` formatı (kebab-case regex), `xp_reward` pozitif integer.
5. Supabase SSR client → `badges` INSERT: `{ name, description, category, code, xp_reward, icon, criteria, tenant_id: auth_tenant_id() }`.
6. DB RLS: `tenant_id = auth_tenant_id()` kontrolü geçer.
7. `revalidatePath('/tenant/gamification')`.
8. Başarı toast → form resetlenir.

**Branch Conditions:**
- `code` aynı tenant'ta zaten varsa → DB unique constraint hata verir → `FAILURE(duplicate_code)` dalı.
- `category` enum dışı değer → Zod parse hatası → `FAILURE(validation_error)`.
- Kullanıcı `tenant_admin` değilse → server action auth guard → `FAILURE(unauthorized)`.

**Failure Modes:**

| Aşama | Hata türü | Sistem davranışı | Kullanıcı görür | Recovery action |
|---|---|---|---|---|
| Zod parse | Eksik/geçersiz alan | Action error object döner | Form alanında hata mesajı | Formu düzelt, yeniden gönder |
| DB unique constraint (`code`) | Duplicate code | Supabase 23505 hata kodu | "Bu kod zaten kullanılıyor" toast | Farklı code seç |
| DB RLS reddi | Tenant uyumsuzluğu | 42501 hata kodu | Genel "Oluşturulamadı" toast | Log; destek |
| Auth guard | Rol yetersiz | 401/403 | Login sayfasına yönlendirme | Doğru rol ile giriş |

**Observable States:**
- UI: `Idle` → form dolu iken `Submitting` → `Success` (liste güncellenir) veya `ValidationError` (form) veya `ServerError` (toast)
- Database: `badges` yeni satır, `tenant_id` set, `is_active = true` (default)
- Logs: `[gamification] badge created badge_code=<code> tenant_id=<tid>`

**Data Contract:**

Inputs:
```
name: string (required, max 100)
description: string (required, max 500)
category: badge_category enum ('performance' | 'consistency' | 'skill' | 'milestone')
code: string (required, kebab-case, unique per tenant)
xp_reward: integer (required, > 0)
icon: string (emoji veya icon key)
criteria: JSONB object
```

Persistence writes: `badges { id uuid, name, description, category, code, xp_reward, icon, criteria, tenant_id, is_active=true, created_at }`

---

#### 3.1.B — Badge Güncelleme (Update)

**Happy Path:**
1. Tenant admin mevcut rozet satırında "Düzenle" tıklar → form önceki değerlerle açılır.
2. Değişiklikler yapılır; form gönderilir → `updateTenantBadgeAction(badgeId, formData)`.
3. Server action: auth + rol + **badge tenant sahipliği** doğrulaması (`WHERE id = badgeId AND tenant_id = auth_tenant_id()`).
4. Zod parse.
5. Supabase SSR client → `badges UPDATE WHERE id = badgeId`.
6. `revalidatePath('/tenant/gamification')`.
7. Başarı toast.

**Branch Conditions:**
- `badgeId` bu tenant'a ait değilse → UPDATE sıfır satır etkiler → `FAILURE(not_found_or_unauthorized)`.
- Aktif bir challenge hâlâ bu badge'e bağlıysa ve kategori değişiyorsa → Açık Soru #1 (cascade davranışı belirsiz).

**Failure Modes:**

| Aşama | Hata türü | Sistem davranışı | Kullanıcı görür | Recovery action |
|---|---|---|---|---|
| Auth / ownership | Badge başkasına ait | 0 rows affected | "Rozet bulunamadı veya izin yok" | — |
| DB unique constraint | code çakışması | 23505 | "Bu kod zaten kullanılıyor" | Farklı code |
| Network | Timeout | Action throws | "Güncelleme başarısız, tekrar deneyin" toast | Manuel retry |

**Observable States:**
- UI: `Idle` → `Submitting` → `Success` (satır güncellenir) veya `ServerError`
- Database: `badges.updated_at` güncellenir

---

#### 3.1.C — Badge Aktif/Pasif Toggle

**Happy Path:**
1. Tenant admin "Aktif/Pasif" toggle butonuna tıklar → `toggleBadgeStatusAction(badgeId, currentStatus)` çağrılır.
2. Server action: auth + ownership doğrulama.
3. `badges UPDATE SET is_active = NOT is_active WHERE id = badgeId AND tenant_id = auth_tenant_id()`.
4. `revalidatePath('/tenant/gamification')` — **bu adım server-side cache'i temizler, client optimistic state değil server state yenilenir**.
5. UI listeyi sunucu verisinden yeniden render eder; toggle butonu yeni state'i yansıtır.

**Kritik Bug (Gelistime4Kontrol.md Item #1):** Şu an "pasif duruma getirildiği bilgisi geldi ancak gerçekten pasif olup olmadığı belli değil" — `revalidatePath` çalışıyor ama client component optimistic state'i sıfırlamıyor. Düzeltme: `toggleBadgeStatusAction` `{ success: true, newStatus: bool }` döndürmeli; client bu değeri kullanarak local state'i sync etmeli.

**Failure Modes:**

| Aşama | Hata türü | Kullanıcı görür | Recovery action |
|---|---|---|---|
| DB update | 0 rows | "Durum güncellenemedi" toast | Sayfayı yenile |
| Network timeout | Action throws | "Bağlantı hatası" toast | Tekrar tıkla |

**Observable States:**
- UI: Buton `loading` state → dönerse toggle görsel değişir → hata olursa eski state'e döner
- Database: `badges.is_active` değişir

---

#### 3.1.D — Badge Silme (Delete) — UI State Transition Detayı

**Happy Path:**
1. Tenant admin çöp kutusu ikonuna tıklar → `ConfirmDialog` açılır: "Bu rozeti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
2. Admin "Evet, sil" onaylar → `deleteBadgeAction(badgeId)` çağrılır.
3. Server action: auth + ownership.
4. Kontrol: Bu badge'e bağlı `user_badges` kaydı var mı? → Varsa `BRANCH(has_awards)`.
5. `badges DELETE WHERE id = badgeId AND tenant_id = auth_tenant_id()`.
6. `revalidatePath('/tenant/gamification')`.
7. UI listeden satır kalkar.

**Kritik Bug (Gelistime4Kontrol.md Item #1):** "Onayladıktan sonra aynı rozet yine ekranda duruyordu" — iki olası sebep:
- (a) `revalidatePath` çağrılıyor ama client component sunucu verisini yeniden fetch etmiyor (Server Component olmayan bir sayfa).
- (b) Action başarısız oluyor (code constraint) ama error handling sessiz — toast çıkmıyor.

Düzeltme sözleşmesi: Action explicit `{ deleted: true }` döndürmeli; client bu sonuca göre yerel state'den ilgili item'ı kaldırmalı (`setItems(prev => prev.filter(b => b.id !== badgeId))`). `revalidatePath` ek güvencedir, birincil mekanizma client state update olmalı.

**Branch Conditions:**
- `user_badges` kaydı varsa (badge zaten kullanıcılara verilmiş) → `BRANCH(has_awards)`: Soft delete değil hard delete bloklansın — badge deactivate edilip kullanıcı kazanımları korunsun. Ekrana "Bu rozet kullanıcılara verilmiş, silinemez; yalnızca pasif yapabilirsiniz" mesajı.
- Badge bu tenant'a ait değilse → 0 rows deleted → hata.

**Failure Modes:**

| Aşama | Hata türü | Kullanıcı görür | Recovery action |
|---|---|---|---|
| has_awards check | Badge verilmiş | "Silinemez, pasif yapın" modal | Önce pasif yap |
| DB foreign key | FK constraint | "Silinemedi" toast | Destek |
| Network | Timeout | "İşlem tamamlanamadı" | Tekrar dene |

**Observable States:**
- UI: Dialog `Idle` → onayda `Deleting` → başarıda satır listeden kaldırılır, dialog kapanır → hata olursa dialog kapanır, toast gösterilir
- Database: `badges` satırı yok; `user_badges` etkilenmez (has_awards branch engeller)

---

#### 3.1.E — Weekly Task (Challenge) — Aynı CRUD Örüntüsü

Challenge CRUD, badge CRUD ile aynı yapıyı izler. Farklar:

- Alanlar: `title`, `description`, `challenge_type` (enum: `session_count` | `score_threshold` | `streak_days`), `target_value` (integer), `xp_reward`, `is_weekly` (boolean), `tenant_id`.
- ADR-002 kapsamı: `challenges.name` (eski NOT NULL) → `title` birincil kolon; `name` nullable veya kaldırılır.
- `is_weekly = true` olan challenge'lar `assign-weekly-challenges` cron'u ile her Pazartesi otomatik `user_challenges`'a dağıtılır.

**Handoff Kontratı (Challenge → Weekly Assign Cron):**

```
Trigger: QStash CRON — her Pazartesi 00:00 UTC
Route: POST /api/cron/assign-weekly-challenges
Payload: (QStash body — imzalı, tenant_id loop içinde)
Action: challenges WHERE is_weekly=true AND is_active=true →
        user_challenges INSERT (user_id, challenge_id, week_start, status='pending')
```

---

#### 3.1.F — User-Facing Badge Award/Consumption

Bu kol `gamification.service.ts::awardXPAndBadges` tarafından yönetilir; tenant admin UI değil, evaluation pipeline sonu tetikler.

**Trigger:** `evaluations` INSERT sonrası `awardXPAndBadges(userId, evaluationResult)`.

**Happy Path:**
1. `gamification_profiles` XP güncellenir (`total_points += xp`); level hesaplanır.
2. `point_transactions` INSERT.
3. `badges` sorgula: bu kullanıcı tenant'ının aktif badge'leri.
4. Her badge için `criteria` JSONB değerlendirmesi (kullanıcı kriteri karşılıyor mu?).
5. Kriterler karşılanıyorsa ve `user_badges` kaydı yoksa → `user_badges` INSERT.
6. `notifications` INSERT (badge kazanıldı bildirim tipi).
7. (ADR-007 uygulandığında) email notification tetiklenir.

**Failure Modes:**

| Aşama | Hata türü | Sistem davranışı | Recovery action |
|---|---|---|---|
| DB yazma | Transaction hatası | Evaluation başarılı, gamification başarısız | Evaluation retry etmez; orphan state. Açık Soru #2. |
| criteria JSONB parse | Geçersiz JSON | Badge atlanır, log yazılır | Criteria düzeltilir, sonraki evaluation trigger'da retry |

---

### 3.2 Bulk User Upload (CSV/XLSX)

**Trigger:** Tenant admin `/tenant/users` sayfasında "Toplu Kullanıcı Yükle" butonuna tıklar.

**Aktörler:**
- Tenant admin (UI)
- Yeni client component: `BulkUploadDialog.tsx`
- Yeni server action: `parseBulkUploadAction(file)` (validation)
- Yeni server action: `commitBulkUploadAction(validatedRows)` (commit)
- Supabase service-role client (`auth.admin.createUser`)
- `public.users` tablo
- Resend email adapter (ADR-007 uygulandıktan sonra — davet e-postası için)

**Precondition'lar:**
- Kullanıcı `tenant_admin` veya `super_admin` rolünde.
- ADR-008 uygulanmış (yeni kullanıcılar için rol hem `users.role` hem `user_metadata.role`'a aynı anda yazılır).
- `users` tablosunda `password_must_change boolean DEFAULT false` kolonu mevcut (Akış 4'ün precondition'u).

**ADR bağımlılığı:** ADR-008 (yeni kullanıcı role sync için), ADR-007 (davet e-postası için, opsiyonel)

**Kod gap durumu:** Missing — hiçbir kodu yok.

---

#### 3.2.A — Template İndirme

**Happy Path:**
1. Admin "Şablon İndir" butonuna tıklar.
2. Sunucu `/api/bulk-upload/template` GET endpoint'i (veya static file) → XLSX veya CSV döner.
3. Tarayıcı indirir.

**Template Formatı (bkz. Bölüm 4).**

---

#### 3.2.B — Dosya Yükleme ve Validation (Parse Aşaması)

**Happy Path:**
1. Admin dolu dosyayı drag-drop veya file input ile seçer.
2. Client-side boyut kontrolü: max 2MB, yalnızca `.csv` veya `.xlsx`.
3. `parseBulkUploadAction(file: FormData)` çağrılır.
4. Server action: auth + rol kontrolü.
5. Dosya tipi tespiti: `.csv` → PapaParse (veya native parse), `.xlsx` → SheetJS (`xlsx` paketi — halihazırda projede yok, eklenecek).
6. Row-by-row validation (aşağıda):
   a. Zorunlu alanlar: `Ad Soyad`, `E-posta`, `Rol` — boş bırakılamaz.
   b. `E-posta`: RFC 5321 format (regex), maksimum 254 karakter.
   c. `Rol`: enum kontrolü — kabul edilen değerler: `user`, `manager`, `hr_admin` (Türkçe karşılıklar da kabul: `kullanici`, `yonetici`, `ik_yonetici` → normalize edilir).
   d. `Departman`: opsiyonel; max 100 karakter.
   e. Batch içi duplicate e-posta tespiti (aynı dosyada iki kez aynı e-posta).
   f. Mevcut kullanıcı çakışması: tenant'ın `users` tablosuna `SELECT WHERE email IN (...)` sorgusu (service-role).
7. Validation sonucu: `{ rows: ParsedRow[], errors: RowError[], summary: { total, valid, invalid } }`.
8. Preview ekrana döner — her satır için durum: `valid` (yeşil), `error` (kırmızı + hata mesajı), `duplicate_in_batch` (turuncu), `duplicate_existing` (sarı + mevcut kullanıcı rolü gösterilir).
9. Admin preview'ı inceler.

**Row-Level Validation Kuralları (tam liste):**

| Kural | Hata kodu | Mesaj |
|---|---|---|
| `Ad Soyad` boş | `REQUIRED_FULL_NAME` | "Ad Soyad zorunludur" |
| `E-posta` boş | `REQUIRED_EMAIL` | "E-posta zorunludur" |
| `Rol` boş | `REQUIRED_ROLE` | "Rol zorunludur" |
| `E-posta` format geçersiz | `INVALID_EMAIL_FORMAT` | "Geçersiz e-posta formatı" |
| `Rol` enum dışı | `INVALID_ROLE` | "Rol değeri geçersiz (user/manager/hr_admin)" |
| Aynı `E-posta` batch'te tekrar | `DUPLICATE_IN_BATCH` | "Bu e-posta aynı dosyada tekrar var (satır X)" |
| `E-posta` sistemde zaten var | `DUPLICATE_EXISTING` | "Bu kullanıcı zaten kayıtlı (rol: X)" |
| Dosya 200 satırı aşıyor | `ROW_LIMIT_EXCEEDED` | "MVP limiti: maksimum 200 satır" |

**Partial Failure Kararı:** **All-or-nothing commit.** Preview aşamasında herhangi bir satırda `error` veya `duplicate_in_batch` varsa "Yükle" butonu devre dışıdır. Yalnızca tüm satırlar `valid` veya `duplicate_existing` (skip olacak) ise commit edilebilir.

`duplicate_existing` satırlar: admin "mevcut kullanıcıyı atla" seçeneği ile commit edebilir; bu satırlar için hiçbir işlem yapılmaz (overwrite yok).

**Branch Conditions:**
- Tüm satırlar valid → "Yükle ve Oluştur" butonu aktif olur.
- Herhangi satırda error → buton disabled, "X satırda hata var, düzeltip yeniden yükleyin" mesajı.
- Dosya 0 satır → "Dosya boş" uyarısı.
- Dosya 200 satırı aşıyor → dosya kabul edilmez; tüm satır validation yapılmaz.

**Failure Modes (parse aşaması):**

| Aşama | Hata türü | Kullanıcı görür | Recovery action |
|---|---|---|---|
| Dosya tipi yanlış | Client check | "Yalnızca .csv veya .xlsx" | Doğru dosya seç |
| Dosya 2MB üstü | Client check | "Dosya çok büyük (max 2MB)" | Dosyayı böl |
| Server parse hatası | SheetJS/PapaParse throw | "Dosya okunamadı, formatı kontrol edin" | Şablonu kullan |
| DB existing user check | DB timeout | "Mevcut kullanıcı kontrolü başarısız, tekrar deneyin" | Retry |

**Observable States (parse):**
- UI: `Idle` → `Uploading` → `Parsing` → `PreviewReady` (valid/error mixed table) veya `ParseError`
- Database: Henüz yazma yok

---

#### 3.2.C — Commit Aşaması

**Happy Path:**
1. Admin preview'ı onaylar, "Yükle ve Oluştur" butonuna tıklar.
2. `commitBulkUploadAction(validatedRows: ParsedRow[])` çağrılır.
3. Temp password oluşturulur: batch için **tek sabit geçici şifre** `Aion2024!` formatına göre — `Aion` + `<YıL>` + `!` sabit string (değiştirilebilir, bkz. Açık Soru #3). **Bu şifre tüm batch kullanıcıları için aynıdır.**
4. Her geçerli satır için sırayla (sequential, paralel değil — rate limit riski):
   a. `supabase.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { role, tenant_id, full_name } })`.
   b. `public.users` INSERT: `{ id: authUser.id, email, full_name, role, tenant_id, department, password_must_change: true }`.
   c. `syncUserRoleToJwt(userId, role)` (ADR-008 helper — user_metadata zaten 4a'da set edildi; bu adım audit log ve double-check için).
5. Tüm satırlar tamamlandıktan sonra:
   a. Temp password **bir kez ekranda gösterilir** (modal/dialog — kopyalanabilir metin) ve "Bu şifre bir daha gösterilmeyecektir" uyarısı.
   b. (ADR-007 uygulandıktan sonra) her kullanıcıya "Hesabınız oluşturuldu, şifrenizi değiştirin" e-postası gönderilir.
6. `revalidatePath('/tenant/users')`.
7. Success özeti: "N kullanıcı oluşturuldu, M atlandı."

**Kısmi Başarı Yönetimi (all-or-nothing prensibi uygulaması):**

4. adımda herhangi bir satır `auth.admin.createUser` veya `users INSERT` hatasına düşerse:
- Başarılı oluşturulan kullanıcılar **geri alınmaz** (Supabase auth.admin'de rollback yok).
- Commit durur; partial sonuç bildirilir: "8/10 kullanıcı oluşturuldu. 9. satır hatası: [hata]. 10. satır işlenmedi."
- Admin kalan satırları düzelterek yeniden yükleme yapabilir; `duplicate_existing` kuralı zaten oluşturulanları atlayacaktır.

Bu yaklaşım teknik gerçeğe göre en güvenli: Supabase auth + Postgres arasında distributed transaction yok; rollback yerine idempotent retry.

**Failure Modes (commit):**

| Aşama | Hata türü | Sistem davranışı | Kullanıcı görür | Recovery action |
|---|---|---|---|---|
| `auth.admin.createUser` — e-posta çakışması | 422 | Bu satırı atla, devam et | Özet: "X zaten vardı, atlandı" | — |
| `auth.admin.createUser` — rate limit | 429 | 2s backoff, 2 retry; sonra dur | "Rate limit aşıldı, X kullanıcı oluşturuldu" | Küçük batch ile yeniden dene |
| `users INSERT` başarısız (auth başarılı) | DB error | Orphan auth user oluştu | "Veri tabanı hatası — destek gerekli" | Manuel cleanup (Açık Soru #4) |
| Network timeout | Fetch throw | Commit kesildi | "Bağlantı kesildi, lütfen sonucu kontrol edin" | Kullanıcı listesini kontrol et |

**Observable States (commit):**
- UI: `PreviewReady` → `Committing` (progress bar: X/N) → `CommitSuccess` (temp password modal) veya `CommitPartial` (kaçı oldu özeti + hata) veya `CommitError`
- Database: `users` yeni satırlar (`password_must_change=true`), Supabase auth.users yeni satırlar
- Logs: `[bulk-upload] created user email=x tenant_id=y`, `[bulk-upload] skipped existing email=z`

**Data Contract:**

Input (parseBulkUploadAction):
```
file: File (.csv veya .xlsx, max 2MB)
```

Input (commitBulkUploadAction):
```
validatedRows: Array<{
  full_name: string
  email: string
  role: 'user' | 'manager' | 'hr_admin'
  department: string | null
  action: 'create' | 'skip'
}>
```

Persistence writes:
```
auth.users { id, email, encrypted_password, email_confirmed_at, user_metadata: { role, tenant_id, full_name } }
public.users { id, email, full_name, role, tenant_id, department, password_must_change: true, created_at }
```

**Handoff Kontratları:**
- Commit tamamlandıktan sonra → Akış 4 (First-Login Password-Change Enforcement) tetik koşulu hazır.
- ADR-007 uygulandıktan sonra → Email Adapter "Hesabınız oluşturuldu" e-postasını gönderir.

---

### 3.3 Invite-Only Onboarding (Tekli Davet)

**Trigger:** Tenant admin `/tenant/users` sayfasında "Kullanıcı Davet Et" butonuna tıklar.

**Aktörler:**
- Tenant admin (UI)
- `InviteUserDialog.tsx` (mevcut client component)
- `user.actions.ts::inviteUserAction` (mevcut, kısmen çalışan)
- `role-sync.ts` helper (ADR-008 — henüz yok)
- Supabase service-role client
- Resend email adapter (ADR-007 — henüz yok)

**Precondition'lar:**
- Kullanıcı `tenant_admin` veya `super_admin` rolünde.
- `users.password_must_change boolean DEFAULT false` kolonu mevcut (Akış 4 precondition'u).
- ADR-008 uygulanmış.

**ADR bağımlılığı:** ADR-008 (P0), ADR-007 (P2 — e-posta için)

**Kod gap durumu:** Partial
- Var: `inviteUserAction`, `InviteUserDialog`
- Eksik: `user_metadata.role` ve `users.role` aynı anda set edilmiyor (ADR-008 açığı)
- Eksik: `password_must_change` flag set edilmiyor
- Eksik: E-posta bildirimi (Resend yokken)

---

**Happy Path:**
1. Tenant admin "Kullanıcı Davet Et" diyalogunu açar; alanları doldurur: `E-posta`, `Ad Soyad`, `Rol`, `Departman` (opsiyonel).
2. Form submit → `inviteUserAction(formData)` çağrılır.
3. Server action: `getCurrentUser()` auth + rol kontrolü.
4. Zod validation: e-posta formatı, rol enum.
5. Mevcut kullanıcı kontrolü: `users WHERE email = ? AND tenant_id = ?` — zaten varsa `FAILURE(already_exists)`.
6. Temp password oluşturulur: `Aion<YIL>!` (aynı bulk upload şema, bkz. Açık Soru #3).
7. `supabase.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { role, tenant_id, full_name } })`.
8. `public.users INSERT { id, email, full_name, role, tenant_id, department, password_must_change: true }`.
9. `syncUserRoleToJwt(userId, role)` — ADR-008 helper (user_metadata zaten set edildi; bu adım audit log için).
10. (ADR-007 sonrası) Resend üzerinden "Hesabınıza erişim bilgileri" e-postası gönderilir: temp password, login URL.
11. `revalidatePath('/tenant/users')`.
12. Dialog kapanır; başarı toast: "Kullanıcı davet edildi. Geçici şifre: [şifre gösterilir — bir kez]."
13. Temp password ekranda gösterilir ve admin kendi not eder (bkz. Açık Soru #5).

**Branch Conditions:**
- E-posta zaten bu tenant'ta varsa → `FAILURE(already_exists)`.
- E-posta Supabase auth'ta başka tenant'la varsa → `auth.admin.createUser` 422 döner → bu edge-case; kullanıcıya "Bu e-posta başka bir hesapla ilişkili" mesajı.
- Rol `super_admin` ise → tenant admin bunu set edemez; Zod'da enum'dan çıkarılır.

**Failure Modes:**

| Aşama | Hata türü | Kullanıcı görür | Recovery action |
|---|---|---|---|
| Duplicate email (tenant) | Kontrol | "Bu e-posta tenant'ta kayıtlı" | Farklı e-posta |
| Duplicate email (global auth) | 422 | "Bu e-posta sistemde başka bir hesapla ilişkili" | Destek |
| `users INSERT` (auth başarılı) | DB error | "Hesap oluşturuldu ama profil kaydedilemedi" | Manuel users INSERT |
| Resend email fail | Non-blocking | "Davet e-postası gönderilemedi. Geçici şifreyi not alın: [X]" | Manuel ilet |

**Observable States:**
- UI: Dialog `Idle` → `Submitting` → `Success` (temp password gösterimi) veya `Error`
- Database: `auth.users` + `users` yeni satırlar, `password_must_change=true`
- Logs: `[invite] user created email=x role=y tenant_id=z`

**Data Contract:**

Inputs:
```
email: string (required, RFC 5321)
full_name: string (required)
role: 'user' | 'manager' | 'hr_admin' (required)
department: string | null
```

Persistence writes:
```
auth.users { user_metadata: { role, tenant_id, full_name } }
public.users { email, full_name, role, tenant_id, department, password_must_change: true }
```

**Handoff Kontratları:**
- Akış 3 biter → Akış 4 (First-Login) için koşul hazır: `users.password_must_change = true`.
- ADR-007 uygulandıktan sonra → Email Adapter "Davet" e-postası.

---

**İlk Login Akışına Geçiş (bkz. Akış 4):**

Davet edilen kullanıcı temp şifresiyle `/login`'e gider. Login başarılı. `(dashboard)/layout.tsx`'deki guard `users.password_must_change` kontrolünü yapar. `true` ise `/change-password`'a redirect.

---

### 3.4 First-Login Password-Change Enforcement

**Trigger:** Herhangi bir dashboard sayfasına istek geldiğinde, `users.password_must_change = true` olan kullanıcı için tetiklenir.

**Aktörler:**
- Davet edilmiş veya bulk upload ile oluşturulan kullanıcı
- `(dashboard)/layout.tsx` guard
- Yeni sayfa: `/change-password/page.tsx`
- Yeni server action: `changePasswordAction(currentPassword, newPassword)`
- Supabase client (`supabase.auth.updateUser`)
- `users` tablo (`password_must_change` flag)

**Precondition'lar:**
- `users.password_must_change boolean DEFAULT false` kolonu `users` tablosunda mevcut (migration gerekli).
- Kullanıcı Supabase auth session'ı var (login başarılı).
- ADR-008 uygulanmış.

**ADR bağımlılığı:** ADR-008 (dolaylı — flag `users` tablosunda)

**Kod gap durumu:** Missing — flag kolonu yok, sayfa yok, action yok, middleware guard yok.

---

**Happy Path:**
1. Kullanıcı temp şifresiyle login olur (Akış 3 veya 2'den gelir).
2. Login başarılı → role-based redirect gibi görünür ama layout guard devreye girer.
3. `(dashboard)/layout.tsx` server component: `getCurrentUser()` → `users.password_must_change` kontrol.
4. `true` ise `redirect('/change-password')` — **orijinal destination override edilir, her dashboard sayfasına erişim engellenir**.
5. `/change-password` sayfası: iki alan — "Yeni Şifre", "Yeni Şifre (tekrar)".
6. Kullanıcı yeni şifreyi girer, gönderir → `changePasswordAction(newPassword, newPasswordRepeat)`.
7. Server action:
   a. `newPassword === newPasswordRepeat` kontrolü.
   b. Şifre güç kuralları: min 8 karakter, en az 1 rakam, en az 1 harf (Açık Soru #6).
   c. Yeni şifre temp şifre ile aynı mı? → `FAILURE(same_as_temp)`.
   d. `supabase.auth.updateUser({ password: newPassword })` — RLS: session kullanıcısı kendi şifresini değiştirir.
   e. `users UPDATE SET password_must_change = false WHERE id = auth.uid()`.
8. Başarı → `redirect('/dashboard')` (veya role-based hedef).

**Branch Conditions:**
- Kullanıcı `/change-password` URL'ini doğrudan girip formu boş bırakarak skip etmeye çalışırsa → action validation hata verir; redirect yok.
- Kullanıcı `/change-password`'u ziyaret etmeden `/api/sessions/[id]/chat`'e istek atarsa → middleware bu API route'unu değil dashboard page'i guard ediyor; API route'lar bu flag'e bakmalı mı? → Açık Soru #7.
- `password_must_change = false` olan kullanıcı `/change-password`'a gelirse → `redirect('/dashboard')` (guard reverse yönü).

**Failure Modes:**

| Aşama | Hata türü | Kullanıcı görür | Recovery action |
|---|---|---|---|
| Şifreler eşleşmiyor | Validation | "Şifreler eşleşmiyor" | Yeniden doldur |
| Şifre zayıf | Validation | "Şifre çok zayıf" | Güçlendir |
| Yeni = temp şifre | Validation | "Yeni şifre geçici şifreyle aynı olamaz" | Farklı şifre |
| `supabase.auth.updateUser` hatası | API error | "Şifre değiştirilemedi, tekrar deneyin" | Retry |
| `users UPDATE` başarısız (auth başarılı) | DB error | Şifre değişti ama flag düşmedi — kullanıcı her login'de bu sayfaya gelir | Admin flag'i manuel sıfırlar (Açık Soru #4) |

**Observable States:**
- UI: `Idle` → `Submitting` → redirect (başarı) veya `ValidationError` / `ServerError`
- Database: `users.password_must_change = false`, Supabase auth şifre güncellendi
- Middleware / Layout: Bir sonraki istekte `password_must_change = false` → `/change-password` redirect yok

**Data Contract:**

Inputs:
```
newPassword: string (min 8 char)
newPasswordRepeat: string
```

Persistence writes:
```
public.users SET password_must_change = false WHERE id = auth.uid()
supabase.auth.users (şifre hash güncellenir — Supabase dahili)
```

**Yeni Migration Gereksinimi:**
```sql
-- 20260423_025_users_password_must_change.sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_must_change boolean NOT NULL DEFAULT false;
```

---

### 3.5 Role Resolution (ADR-008 sonrası temiz akış)

**Trigger:** Herhangi bir rol yazma işlemi (invite, bulk upload, admin rol güncelleme).

**Aktörler:**
- Admin/tenant admin (UI)
- `role-sync.ts` helper (ADR-008 — yeni dosya: `src/lib/auth/role-sync.ts`)
- Supabase service-role client (`auth.admin.updateUserById`)
- `users` tablo
- `audit_logs` tablo
- Middleware (tüketici)
- Server actions (tüketici)

**ADR bağımlılığı:** ADR-008 (P0)

**Kod gap durumu:** Partial — iki kaynaklı durum; sync helper yok; `updateUserRoleAction` mevcut ama JWT'yi güncellemiyor.

---

#### 3.5.A — Rol Güncelleme (Admin UI)

**Happy Path:**
1. Tenant admin `/tenant/users` sayfasında bir kullanıcının rolünü değiştirir → `updateUserRoleAction(userId, newRole)`.
2. Server action: `getCurrentUser()` — caller `tenant_admin` veya `super_admin`.
3. Hedef kullanıcının `tenant_id` kontrolü: aynı tenant mı? (`super_admin` bu kontrolü bypass edebilir).
4. `users UPDATE SET role = newRole WHERE id = userId AND tenant_id = auth_tenant_id()`.
5. `syncUserRoleToJwt(userId, newRole)` — `role-sync.ts` helper:
   a. `supabase.auth.admin.updateUserById(userId, { user_metadata: { role: newRole } })`.
   b. `audit_logs INSERT { actor_id, target_user_id, action: 'role_change', old_role, new_role, timestamp }`.
6. `revalidatePath('/tenant/users')`.
7. Başarı toast.
8. Kullanıcıya bildirim (opsiyonel, ADR-007 sonrası e-posta).

**Rol Değişikliği Sonrası JWT Yenileme:**

Kullanıcı hâlâ aktif bir session'da ise:
- Yeni `user_metadata` Supabase'de güncellendi.
- Kullanıcının mevcut JWT'si **bir sonraki `updateSession` çağrısına** kadar eskidir (middleware her request'te refresh yapar — maksimum süre Supabase session expiry: 1 saat).
- **Güvenli seçenek (zorunlu değil MVP'de):** `supabase.auth.admin.signOut(userId, 'others')` ile kullanıcının mevcut token'ını geçersiz kıl. Sonraki istek yeniden login'e yönlendirir.
- Açık Soru #8: Force sign-out zorunlu mu, yoksa "en fazla 1 saat gecikme" kabul edilebilir mi?

**Branch Conditions:**
- Rol değişmiyor (aynı rol seçildi) → action early return; DB veya JWT dokunulmaz.
- `syncUserRoleToJwt` başarısız olursa (auth admin API hatası) → `users.role` güncellendi ama JWT eski; transaction benzeri rollback: `users.role` eski değere geri yazılır + error toast.
- Hedef kullanıcı `super_admin`'i `tenant_admin` değiştirmeye çalışıyorsa → Zod/auth guard reddeder.

**Failure Modes:**

| Aşama | Hata türü | Sistem davranışı | Kullanıcı görür | Recovery action |
|---|---|---|---|---|
| DB UPDATE | RLS reddi | users.role değişmedi | "Rol güncellenemedi" toast | Yetki kontrol et |
| `auth.admin.updateUserById` | API error | users.role güncellendi, JWT eskide | "Kısmi güncelleme — kullanıcı yeniden giriş yapmalı" toast | Kullanıcı logout/login |
| Rollback (DB + JWT tutarsız) | DB error on rollback | Tutarsız state | Kritik log; destek | Manuel admin müdahale |

**Observable States:**
- UI: `Idle` → `Updating` → `Success` (kullanıcı listesi yenilenir) veya `Error`
- Database: `users.role` yeni değer; `auth.users.user_metadata.role` yeni değer; `audit_logs` yeni satır
- Middleware: Kullanıcının bir sonraki isteğinde yeni `user_metadata.role` görülür

---

#### 3.5.B — Rol Okuma (ADR-008 sonrası)

**Middleware (coarse gate):** JWT `user_metadata.role` okur — hızlı, DB'ye gitmez. `SUPER_ADMIN_ROUTES`, `ADMIN_ROUTES`, `MANAGER_ROUTES` koruma. ADR-008 sonrası bu değer her zaman `users.role` ile senkrondur (write path disiplini garanti eder).

**Server actions (fine gate):** `getCurrentUser()` → `users.role` okur (SSR client, RLS). Bu kaynak zaten DB'deyse garantili doğrudur.

**RLS helper'lar (`auth_role()`):** Supabase SQL fonksiyonu — JWT'den `user_metadata.role` okur. ADR-008'den sonra bu değer de güvenilirdir çünkü write path her ikisini de günceller.

**Drift Recovery:**
- Her `updateSession` çağrısı (middleware — her request) Supabase cookie'yi refresh eder; bu noktada yeni JWT claim'i gelir.
- `users.role` ve `user_metadata.role` arası drift tespit mekanizması: `/api/health` endpoint'ine `role_sync_check` eklenebilir — belirli bir user için her iki kaynağı karşılaştırır (opsiyonel, monitoring).

---

### 3.6 Evaluation Pipeline (QStash — ADR-001 sonrası)

**Trigger:** `endSessionAction(sessionId, reason)` çağrısı (kullanıcı "Seansı Bitir" yapar veya AI `[SESSION_END]` marker gönderir).

**Aktörler:**
- `session.actions.ts::endSessionAction`
- `evaluation.queue.ts::scheduleEvaluationJob`
- Upstash QStash (message broker)
- `api/sessions/[id]/evaluate/route.ts` (worker)
- `evaluation.engine.ts::runEvaluation`
- OpenAI API (LLM JSON mode)
- `gamification.service.ts::awardXPAndBadges`
- `evaluations`, `dimension_scores`, `gamification_profiles`, `user_badges`, `notifications` tabloları

**Precondition'lar:**
- ADR-001 uygulanmış: env değişkenleri `UPSTASH_QSTASH_TOKEN`, `UPSTASH_QSTASH_CURRENT_SIGNING_KEY`, `UPSTASH_QSTASH_NEXT_SIGNING_KEY`, `QSTASH_RECEIVER_URL` set edilmiş.
- Session `status = 'completed'`.
- `session_messages` tablosunda en az 1 asistan mesajı.
- OpenAI API key set edilmiş.
- `QSTASH_RECEIVER_URL` deploy edilen URL ile eşleşiyor (örn. `https://app.aion.com/api/sessions/[id]/evaluate`).

**ADR bağımlılığı:** ADR-001 (P0 — env isimleri yanlışsa QStash çağrısı sessizce başarısız)

**Kod gap durumu:** Partial — kod tamamen yazılmış; tek blocker ADR-001 env düzeltmesi + OPENAI_API_KEY'in dolu olması.

---

**Happy Path:**
1. Kullanıcı "Seansı Bitir" tıklar veya AI `[SESSION_END]` marker gönderir.
2. `endSessionAction(sessionId, 'user_ended' | 'ai_ended')`:
   a. `sessions UPDATE SET status='completed', completed_at=now(), duration_seconds=...`.
   b. `scheduleEvaluationJob(sessionId)` — fire-and-forget.
3. `scheduleEvaluationJob`:
   a. QStash `publishJSON({ url: QSTASH_RECEIVER_URL, body: { sessionId }, delay: 5 })` — 5 saniye gecikme.
   b. `UPSTASH_QSTASH_TOKEN` ile imzalanır.
4. Kullanıcı ekranda `sessionEnded: true` → `/dashboard/sessions/[id]/report`'a yönlenir.
5. Report sayfası: evaluations tablosunda bu session için kayıt var mı? → Yok → "Değerlendirme hazırlanıyor..." loading state.
6. QStash 5 saniye sonra `POST /api/sessions/[id]/evaluate` çağırır.
7. Route handler:
   a. `Receiver.verify(signature, body)` — `UPSTASH_QSTASH_CURRENT_SIGNING_KEY` ve `UPSTASH_QSTASH_NEXT_SIGNING_KEY` ile.
   b. İmza geçersizse → `401` döner → QStash retry etmez (non-retryable error).
   c. Session mevcut mu, status `completed` mı? → Değilse `400`.
   d. `evaluations` tablosunda zaten kayıt var mı? → Varsa `200` idempotent return.
8. `runEvaluation(sessionId)`:
   a. `prompt_logs`'tan son system prompt al → `decrypt`.
   b. `getSessionHistory(sessionId)` → tüm mesajlar.
   c. Rubric template al (session'ın scenario'su üzerinden).
   d. `evaluation.prompt.builder` → evaluation prompt oluştur.
   e. `OpenAILLMAdapter` → JSON mode ile `gpt-4o` çağrısı.
   f. LLM response parse: `{ overall_score, strengths[], development_areas[], coaching_note, manager_insight, dimension_scores[] }`.
9. `evaluations INSERT { session_id, overall_score, strengths, development_areas, coaching_note, manager_insight, status:'completed' }`.
10. `dimension_scores INSERT` (her boyut için ayrı satır).
11. `awardXPAndBadges(userId, evaluationResult)` — bkz. Akış 3.1.F.
12. `notifications INSERT { user_id, type: 'evaluation_completed', payload: { session_id } }`.
13. Report sayfası: kullanıcı `NotificationPoller` veya manuel yenileme ile değerlendirme hazır olduğunu görür; içerik render edilir.

**QStash Retry Davranışı:**

QStash default: 3 retry, üstel geri çekilme (1s, 5s, 30s). Route handler:
- `2xx` → başarı, retry yok.
- `4xx` → QStash retry etmez (client error — imza hatası, session bulunamadı).
- `5xx` → QStash retry eder (3 kez).

**Branch Conditions:**
- `evaluations` zaten var (idempotent check) → `200` + early return; gamification tekrar çalışmaz.
- LLM response JSON parse hatası → `500` → QStash retry eder (3 kez sonra fail).
- OpenAI API key boş → immediate `500` → QStash 3x retry → tükenir → session'ın evaluation'ı yok.

**Failure Modes:**

| Aşama | Hata türü | Sistem davranışı | Kullanıcı görür | Recovery action |
|---|---|---|---|---|
| QStash publish | UPSTASH_QSTASH_TOKEN boş | Silent fail (fire-and-forget) | "Değerlendirme hazırlanıyor" durumunda kalır | ADR-001 uygula |
| İmza doğrulama | Yanlış signing key | 401, retry yok | Değerlendirme hiç gelmez | Signing key kontrol |
| OpenAI API | 429 rate limit | 500 → QStash retry | Delay sonra değerlendirme gelir | Otomatik (retry) |
| OpenAI API | API key boş | 500 (her retry) | Değerlendirme hiç gelmez | API key set et |
| LLM JSON parse | Malformed response | 500 → QStash retry → 3x tükenir | Değerlendirme gelmiyor | Retry akışı (bkz. Açık Soru #9) |
| `evaluations INSERT` | DB error | 500 → retry | Gecikme sonra gelir | Otomatik (retry) |
| `awardXPAndBadges` | Hata | Evaluation kaydedildi, gamification eksik | Puan/rozet yok | Log; manual trigger (Açık Soru #2) |
| Report sayfası poll | Evaluation 3+ dakika gelmez | Loading state sürer | "Değerlendirme bekleniyor..." timeout mesajı | Sayfayı yenile |

**Observable States:**
- Kullanıcı:
  - Seans biter → rapor sayfasına yönlenir → "Değerlendirme hazırlanıyor" spinner
  - QStash deliver + evaluation done → sayfa yenilenir → skorlar görünür
  - Fail → "Değerlendirmeniz tamamlanamadı" mesajı (bu state şu an UI'da yok — gap)
- Operator:
  - `evaluations` tablosunda `status` sütunu: `processing` → `completed` veya `failed`
  - `audit_logs`: evaluation eventi
- Database: `evaluations`, `dimension_scores`, `gamification_profiles`, `user_badges`, `notifications` güncellenir

**Handoff Kontratı (endSessionAction → QStash):**

```
HANDOFF: session.actions.ts → QStash
  METHOD: POST (QStash publishJSON)
  URL: process.env.QSTASH_RECEIVER_URL
  PAYLOAD: { "sessionId": "uuid" }
  DELAY: 5 saniye
  RETRIES: 3 (QStash default)
  AUTH: UPSTASH_QSTASH_TOKEN (Bearer)
  ON PUBLISH FAILURE: fire-and-forget — silent fail; session status 'completed' kalır
```

**Handoff Kontratı (QStash → Evaluate Route):**

```
HANDOFF: QStash → POST /api/sessions/[id]/evaluate
  HEADERS: Upstash-Signature
  BODY: { "sessionId": "uuid" }
  SUCCESS RESPONSE: { "ok": true } HTTP 200
  FAILURE RESPONSE: HTTP 4xx (no retry) veya 5xx (retry)
  TIMEOUT: Vercel function timeout (varsayılan 30s) — LLM çağrısı bu süreye dahil
  ON TIMEOUT: 5xx → QStash retry
```

**Data Contract:**

Persistence writes:
```
evaluations {
  session_id uuid,
  overall_score decimal(3,2) 0..5,
  strengths text[],
  development_areas text[],
  coaching_note text,
  manager_insight text,
  status 'completed',
  created_at
}
dimension_scores {
  evaluation_id uuid,
  dimension_code rubric_dimension_code,
  score decimal(3,2),
  evidence text
}
```

---

## 4. CSV/XLSX Template (Bulk Upload için)

**Dosya adı:** `aion_kullanici_sablonu.xlsx` (veya `.csv`)

**Kolon başlıkları (tam olarak bu şekilde, case-sensitive):**

| A | B | C | D |
|---|---|---|---|
| Ad Soyad | E-posta | Rol | Departman |

**Örnek satırlar:**

| Ad Soyad | E-posta | Rol | Departman |
|---|---|---|---|
| Ahmet Yılmaz | ahmet.yilmaz@sirket.com | user | Satış |
| Zeynep Kaya | zeynep.kaya@sirket.com | manager | İnsan Kaynakları |
| Can Demir | can.demir@sirket.com | hr_admin | İK |
| Elif Şahin | elif.sahin@sirket.com | user | Pazarlama |

**Kural notları (şablona footer olarak eklenecek):**
- `Rol` alanı yalnızca `user`, `manager`, `hr_admin` değerlerini kabul eder.
- `Departman` opsiyoneldir, boş bırakılabilir.
- Aynı dosyada e-posta tekrar edemez.
- Maksimum 200 satır (header hariç).
- Şifreler sistem tarafından otomatik oluşturulur; ilk girişte değiştirmeniz zorunludur.

**Teknik notlar (parser implementasyonu için):**
- CSV: UTF-8 BOM (Türkçe karakter güvenliği için `﻿` prefix).
- XLSX: Sheet adı `Kullanıcılar` (yoksa ilk sheet alınır).
- Boş satırlar (tüm hücreler boş) sessizce atlanır.
- Başlık satırı (ilk satır) her zaman skip edilir.
- Hücre değerleri trim edilir (başı/sonu boşluk).

---

## 5. Downstream Agent'lara Devir

### 5.1 Project Shepherd için

**ADR önceliklerine göre akış fazlama önerisi:**

#### Faz 0 — Bloker Kapat (2-3 gün)
Bloker ADR'lar: ADR-001, ADR-002, ADR-008

Faz 0 kapsamında çözülmesi gereken akışlar:
- Akış 1 (Badge/Challenge CRUD) — ADR-002 bitmeden create kırık
- Akış 5 (Role Resolution) — ADR-008 bitmeden güvensiz
- Akış 3 (Invite Onboarding) — ADR-008 olmadan role sync eksik

Not: Akış 1 UI delete bug'u (ekrandan kaybolmama) ADR-002'den bağımsız client-side düzeltme — Faz 0'da yapılabilir.

#### Faz 1 — Yeni Özellikler (1-2 hafta)
Akış 2 (Bulk Upload) ve Akış 4 (Password Change Enforcement) — tamamen yeni kod, ADR blokeri yok ama ADR-008 tamamlanmış olmalı.

Efor kaba tahmin:
- Akış 2 (Bulk Upload): **L** — yeni API route, yeni komponent, SheetJS entegrasyonu, row-level validation, commit flow, migration, email (ADR-007 sonrası)
- Akış 4 (Password Change): **M** — migration, yeni sayfa, action, layout guard değişikliği

#### Faz 2 — Pipeline Stabilitesi
Akış 6 (Evaluation) — ADR-001 dakikada çözülür; sonra e2e test gerekir (OpenAI key gerekli).

**Aynı build window'da yapılabilecekler (bağımsız):**
- ADR-001 (env rename) + ADR-005 (next.config) → aynı PR, dakikalar
- Akış 2 + Akış 4 → aynı sprint (her ikisi de user provisioning alanında)
- ADR-002 migration + Akış 1 düzeltmeleri → aynı PR

**Zincirli bağımlılar (sıralı):**
1. ADR-002 → Akış 1 çalışır
2. ADR-008 → Akış 3 güvenli → Akış 4 anlamlı
3. ADR-001 → Akış 6 çalışır → Gamification ödülleri (Akış 1.F) güvenilir

---

### 5.2 Builder / Implementation için

**Akış başına kritik dosyalar:**

| Akış | Değiştirilecek/oluşturulacak dosyalar |
|---|---|
| 1 — Badge/Challenge | `src/lib/actions/gamification.actions.ts` (code field fix), `src/components/tenant/GamificationLists.tsx` (client state update on delete/toggle), `supabase/migrations/20260423_024_badges_schema_unification.sql` |
| 2 — Bulk Upload | `src/app/(dashboard)/tenant/users/page.tsx` (upload button), `src/components/tenant/BulkUploadDialog.tsx` (new), `src/lib/actions/user.actions.ts` (parseBulkUploadAction, commitBulkUploadAction — new), `src/app/api/bulk-upload/template/route.ts` (new), `supabase/migrations/20260423_025_users_password_must_change.sql` |
| 3 — Invite Onboarding | `src/lib/actions/user.actions.ts` (inviteUserAction — password_must_change flag + role-sync), `src/lib/auth/role-sync.ts` (new — ADR-008) |
| 4 — Password Change | `src/app/(dashboard)/layout.tsx` (password_must_change guard), `src/app/(dashboard)/change-password/page.tsx` (new), `src/lib/actions/auth.actions.ts` (changePasswordAction — new) |
| 5 — Role Resolution | `src/lib/auth/role-sync.ts` (new), `src/lib/actions/user.actions.ts` (updateUserRoleAction fix), `src/modules/auth/actions.ts` (inviteUserAction sync) |
| 6 — Evaluation | `.env.local.example` (ADR-001 rename), `CLAUDE.md` (env listesi güncel), `/api/health/route.ts` (QStash probe ekle) |

**Kritik pattern'ler:**

1. **Server action + revalidatePath birlikte kullanılmalı** — her mutation sonrası `revalidatePath('/tenant/gamification')` gibi. Ancak client component optimistic state de elle güncellenmeli (delete sonrası `setItems(prev => prev.filter(...))`).

2. **Tüm rol yazma işlemleri `role-sync.ts` üzerinden geçmeli** — doğrudan `users UPDATE` yapmak yetkilendirme drift'i yaratır.

3. **Bulk upload commit sequential, parallel değil** — `Promise.all` ile tüm satırları aynı anda oluşturmak Supabase auth rate limit'ini (genellikle 100 req/saat) patlatır. `for...of` + `await` ile sıralı, her hata bağımsız handle edilmeli.

4. **`password_must_change` guard, layout'ta server-side** — middleware'de değil, `(dashboard)/layout.tsx` server component'ında. Middleware edge runtime'da DB sorgusu pahalı; layout server component'ı Supabase SSR client kullanabilir.

5. **Evaluation idempotency check** — `evaluations` tablosuna INSERT'ten önce `SELECT WHERE session_id = ?` sorgusu; sonuç varsa early return. QStash retry'larında aynı evaluation'ın iki kez yazılmasını önler.

---

### 5.3 Evidence Collector / QA için

**Akış başına minimum kabul kriterleri:**

**Akış 1 — Badge CRUD:**
- [ ] Tenant admin yeni rozet oluştururken `code` alanı boş bırakılırsa form hata verir.
- [ ] Aynı `code` ile ikinci rozet oluşturmaya çalışılırsa "Bu kod zaten kullanılıyor" hatası görülür.
- [ ] Toggle: Pasif yapıldıktan sonra sayfa yenilenmeden toggle butonunun durumu güncellenir.
- [ ] Silme: Onay sonrası silinen rozet listeden kaybolur (yenileme gerekmez).
- [ ] Silme: `user_badges` kaydı olan rozet silinmeye çalışılırsa "Silinemez" mesajı görülür.

**Akış 2 — Bulk Upload:**
- [ ] Geçersiz format (`.txt`) yüklenirse client-side hata verir.
- [ ] 201 satırlı dosya yüklenince "Limit aşıldı" hatası verir (şablonu kabul etmez).
- [ ] Hatalı e-posta formatı olan satır preview'da kırmızı gösterilir; "Yükle" butonu disabled.
- [ ] Tüm satırlar geçerliyse commit sonrası geçici şifre modal gösterilir.
- [ ] Mevcut kullanıcı e-postası olan satır sarı gösterilir; commit'te atlanır.
- [ ] Commit sonrası `/tenant/users` listesinde yeni kullanıcılar görünür.
- [ ] Yeni kullanıcı temp şifreyle login olduğunda `/change-password`'a yönlendirilir.

**Akış 3 — Invite:**
- [ ] Davet edilen kullanıcı `users` tablosunda `password_must_change = true` ile oluşturulur.
- [ ] Rol değişince `user_metadata.role` da güncellenir (Supabase auth.users'ta).

**Akış 4 — Password Change:**
- [ ] `password_must_change = true` kullanıcı `/dashboard`'a gitmeye çalıştığında `/change-password`'a yönlendirilir.
- [ ] `password_must_change = true` kullanıcı doğrudan `/tenant/gamification` URL girse bile `/change-password`'a yönlendirilir.
- [ ] Temp şifre ile aynı şifre girilirse hata mesajı görülür.
- [ ] Başarılı değişiklik sonrası `/change-password`'a tekrar gidilmeye çalışılırsa `/dashboard`'a yönlendirilir.

**Akış 5 — Role Resolution:**
- [ ] Tenant admin rol değiştirince sunucu `audit_logs`'a yeni satır yazar.
- [ ] Rol değiştirilen kullanıcı logout/login yaptığında yeni role ile doğru sayfaya yönlendirilir.
- [ ] `middleware.ts` yanlış role ile korunan rotaya erişimi reddeder.

**Akış 6 — Evaluation:**
- [ ] Seans bittikten sonra 30 saniye içinde `/dashboard/sessions/[id]/report` sayfasında değerlendirme görünür.
- [ ] QStash imza doğrulaması başarısız olursa route 401 döner ve tekrar denenmez.
- [ ] Aynı session için iki kez evaluate çağrılırsa ikincisi idempotent 200 döner, `evaluations` tablosunda tek satır kalır.

**Regresyon smoke test noktaları (önceki bug'lar için):**
- Badge oluşturma `code NOT NULL` constraint hatası yok (Gelistime.md #12, Gelistime2.md #8).
- Challenge oluşturma `name NOT NULL` hatası yok (Gelistime2.md #9).
- Rol güncelleme "Rol güncellenemedi" toast yok (Gelistime3.md #1) — JWT de güncelleniyor.
- Toggle sonrası durum gerçekten değişiyor (Gelistime4Kontrol.md Item #1).
- Silme sonrası kayıt listeden kayboluyor (Gelistime4Kontrol.md Item #1).

---

## 6. Açık Sorular (Kullanıcıya)

Aşağıdaki sorular akış tasarımı sırasında belirlenmiştir ve kullanıcı kararını gerektirmektedir. Her soru iş kararı niteliğinde; Workflow Architect bunları varsayım olarak çözemiyor.

**Soru #1 — Badge güncelleme: aktif challenge cascade**
Bir badge'in `category`'si değiştirildiğinde, bu badge'e bağlı aktif `user_challenges` kayıtları ne olacak? Seçenekler: (a) cascade update — challenge kategorisi de değişir, (b) değişiklik engellenir — "Bu badge aktif challenge'lara bağlı, düzenlenemez" mesajı, (c) challenge'lar bağımsız kalır — category değişikliği yalnızca yeni atamalar için geçerli.

**Soru #2 — Gamification `awardXPAndBadges` hata durumu**
Evaluation başarılı ama `awardXPAndBadges` başarısız olursa (DB write hatası) ne yapılsın? Seçenekler: (a) kullanıcıya hiç bildirim yok — puan/rozet sessizce eksik kalır, (b) `gamification_retry_queue` mantığı — evaluation route 200 döner ama gamification ayrıca yeniden denenir, (c) evaluation 5xx döner → QStash gamification da dahil her şeyi retry eder (ama evaluation duplicate riski var). Bu kararı vermeden gamification hata yönetimi spec'lenemez.

**Soru #3 — Geçici şifre formatı ve değişebilirlik**
Bulk upload ve tekli davet için aynı geçici şifreyi (`Aion<YIL>!` gibi) mi kullanacağız? Eğer tüm batch için aynı şifre ise güvenlik riski kabul edilebilir mi (admin birden fazla kişiye aynı şifreyi iletir)? Alternatif: her kullanıcı için rastgele 12 haneli şifre üretilir ve admin UI'da liste halinde gösterilir. Tercih?

**Soru #4 — Bulk commit kısmi başarı durumunda orphan kullanıcı yönetimi**
`auth.admin.createUser` başarılı ama `public.users INSERT` başarısız olan kullanıcılar için manuel cleanup prosedürü ne olacak? Bu nadiren olur ama olduğunda Supabase admin panelinden mi temizlenecek? Yoksa otomatik cleanup cron'u mu oluşturalım?

**Soru #5 — Davet sonrası geçici şifre iletimi**
Geçici şifre nasıl kullanıcıya ulaşacak? Seçenekler: (a) yalnızca admin UI'da bir kez gösterilir — admin copy-paste ile iletir, (b) Resend ile doğrudan kullanıcı e-postasına gönderilir (ADR-007 sonrası), (c) her ikisi birden. ADR-007 uygulanana kadar (a) tek seçenek; (b) hazır olduğunda otomatik devreye girebilir. Bu MVP kararı mı?

**Soru #6 — Şifre güç kuralları**
Yeni şifre için minimum gereksinimler: minimum 8 karakter yeterli mi, yoksa sayı/büyük harf/özel karakter zorunlu mu? Türkiye'deki KVKK uyum standartları için öneri: en az 8 karakter, en az 1 rakam, en az 1 büyük harf.

**Soru #7 — `password_must_change` guard: API route'ları da kapsamalı mı?**
Şu anki tasarım yalnızca dashboard layout'unda guard koyuyor. Kullanıcı tarayıcıda `/api/sessions/[id]/chat`'e doğrudan POST atarsa guard devreye girmez. Bu senaryo gerçekçi mi (direct API call)? Eğer evet, middleware'e de `password_must_change` kontrolü ekleyelim mi (DB hit gerektirir)?

**Soru #8 — Rol değişikliği sonrası force sign-out zorunlu mu?**
ADR-008 spec'ine göre rol değişikliği JWT'yi senkron günceller ama kullanıcının aktif session'ı eski token'la çalışmaya devam eder (maksimum 1 saate kadar). Bu süre MVP için kabul edilebilir mi? Yoksa rol değişikliği anında `supabase.auth.admin.signOut(userId, 'others')` ile force logout mu yapayım?

**Soru #9 — Evaluation kalıcı başarısızlık durumunda kullanıcı deneyimi**
QStash 3 retry tüketildi, evaluation hâlâ başarısız (örn. OpenAI down). Kullanıcı rapor sayfasında sonsuza kadar "Hazırlanıyor" görecek mi? Yoksa bir timeout (ör. 10 dakika) sonrası "Değerlendirme şu an yapılamadı, daha sonra tekrar deneyin" mesajı mı gösterelim? Bu UI state şu an mevcut değil.

---

## 7. İncelenen Kaynaklar

- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/Gelistirme23Nisan/system_analiz_20260423.md` — Bölümler 2, 3, 4.2, 4.3 (tam)
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/Gelistirme23Nisan/mimari_kararlar_20260423.md` — ADR-001 ile ADR-009, Cross-cutting prensipler, Downstream devir (tam)
- `/Users/ozcanbalioglu/projeler/AIUON MIRROR/roleplay-saas/Gelistime4Kontrol.md` — Item #1 (gamification CRUD canlı bug kanıtı), Item #2, #3, #4 (profil, tasarım — akış kapsamı dışı)
- Kod dosyaları onboarding belgesi üzerinden okundu; ek dosya okuma yapılmadı (mevcut ground truth yeterli).

---

## Güncelleme — 2026-04-23 Akşamı

### §6 Açık Sorulara Kullanıcı Yanıtları

Workflow Architect belgesi yazıldıktan sonra kullanıcı üç kritik soruya yanıt verdi:

**Soru 1 (Geçici şifre formatı): C — Batch başına sabit şifre.**
Admin bulk upload sırasında batch için bir geçici şifre belirler veya sistem üretir ve bir kez gösterir (sayfa kapanınca kaybolur). Aynı batch'teki tüm kullanıcılar aynı şifreyi alır; farklı batch'ler farklı şifreler alır.
→ §3.2 (Bulk Upload) ve §3.4 (First-Login Password Change) bu yönde uygulanacak.
→ Implementation notu: Upload form'unda admin "Batch için geçici şifre" field'ı görür (boş bırakırsa sistem 12+ karakterlik rastgele şifre üretir). Commit sonrası şifre tek kez bir modal'da ve clipboard-copy butonuyla gösterilir — "Bu ekran bir daha açılmayacak, şimdi kopyalayın" uyarısıyla.

**Soru 2 (Rol değişikliği sonrası session davranışı): A — Force sign-out.**
Admin bir kullanıcının rolünü değiştirdiğinde aktif oturum zorla kapatılır. Kullanıcı tekrar login olduğunda yeni rol anında devreye girer.
→ §3.5 (Role Resolution) implementation gereği: admin role update server action'ının sonunda `supabase.auth.admin.signOut(userId, 'others')` çağrısı; gerekiyorsa realtime channel üzerinden client'a force-refresh sinyali.
→ Defense-in-depth: eski JWT ile gelen request'lere karşı server guard'ı `users.role` ile doğrulayıp 401 dönebilir.

**Soru 3 (Evaluation kalıcı başarısızlık UI): B — Timeout + "Yeniden dene" butonu.**
3 QStash retry tükendikten sonra kullanıcı rapor sayfasında "Değerlendirme başarısız oldu, yeniden deneyin" mesajı + retry butonu görür.
→ §3.6 (Evaluation Pipeline) Failure Modes tablosunda "3. retry tükendi" için:
  - Session state: `evaluation_failed`
  - UI: Değerlendirme kartı hata state'inde, retry butonlu
  - Retry click → server action yeni QStash job publish eder, state `evaluation_pending`'e döner
  - Future monitoring: admin dashboard'da `evaluation_failed` state'teki session'lar filtrelenebilir olsun

### Yeni Gözlem — Standard `user` Rolünde Profil Güncelleme Bug'ı (P0)

Gelistime4Kontrol.md Item #2 sadece **Tenant Admin** rolü için test edilmiş ve düzeldiği rapor edilmişti. Kullanıcı 2026-04-23 akşamında **standart `user` rolünde** aynı sayfayı denediğinde:
- Profil fotoğrafı yüklenmiyor — orijinal `Bucket not found` hatası veya RLS hatası `user` rolü için geri gelmiş
- Input alanları güncellenmiyor — `Profil güncellenemedi.` hatası

Hipotez edilen kök sebepler (Builder doğrulamalı):
1. **Storage RLS mismatch:** `avatars` bucket yazma policy'si `tenant_admin` rolüne göre yazılmış, `user` self-upload senaryosunu dışlamış
2. **`public.users` UPDATE RLS:** policy `auth.uid() = id` self-update koşulunu eksik taşıyor — sadece `tenant_admin` update edebiliyor
3. **Migration `20260422_023_storage_avatars_bucket.sql` policy'leri** tenant_admin odaklı yazılmış olabilir

→ Phase 0 P0 scope'a eklenmeli. İncelenecek dosyalar:
- `supabase/migrations/20260422_023_storage_avatars_bucket.sql`
- `src/lib/actions/profile.actions.ts` (veya eşdeğer profil update action dosyası)
- `src/app/**/profile/page.tsx`

Not: Bu bug ADR-008 (role dualism) ile dolaylı ilgili ama kök sebep RLS policy dizimi, rol kaynağının iki yerde tutulması değil.

### Deferred Scope — AI Roleplay Çekirdek Akışı ✅ TAMAMLANDI (2026-04-24)

2026-04-24 spec session'ında kullanıcı ile birlikte çalışılarak tamamlandı. Aşağıdaki §7-§13 akışları bu deferred scope'un yerini alır. Detayları için [`rubric_icf_20260424.md`](./rubric_icf_20260424.md) ve yol haritasındaki P2-100 serisi item'larına bakınız.

---

## 7. Phase 2 Akışları — AI Roleplay Core Flow

Bu bölüm 2026-04-24 spec session'ı çıktısıdır. Önceki §1-§6 akışları "uygulama kabuğu" katmanını (auth, tenant, gamification CRUD, evaluation pipeline iskeleti) tanımlamıştır. §7-§13 "ana ürün deneyimi" katmanını tanımlar — kullanıcının karşılaşacağı roleplay seansının başından sonuna kadar.

**Registry — Phase 2:**

| # | Akış | Spec bölümü | Durum | Trigger | Primary actor | ADR bağımlılığı |
|---|---|---|---|---|---|---|
| 7 | Sesli Seans Başlatma + Roleplay | 7.1 | Draft | Mikrofon butonu | `VoiceSessionClient` + chat API | ADR-011, ADR-014 |
| 8 | Seansı Yarıda Kesme | 7.2 | Draft | "Yarıda Kes" buton | `cancelSessionAction` + reason modal | ADR-011 |
| 9 | Debrief + Evaluation Paralel | 7.3 | Draft | "Seansı Bitir" buton | `endSessionAction` + debrief client + QStash | ADR-012 |
| 10 | Sesli Rapor Sunumu | 7.4 | Draft | Rapor sayfası mount | `generateReportAudioAction` + Supabase Storage | ADR-012 |
| 11 | Transcript Özetleme (Background) | 7.5 | Draft | Her 5 mesaj | QStash → `/api/sessions/[id]/summarize` | ADR-013 |
| 12 | Development Plan Aggregate | 7.6 | Draft | Evaluation complete | QStash → `/api/users/[id]/development-plan/regenerate` | ADR-015 |
| 13 | Super Admin Feedback Review | 7.7 | Draft | Debrief complete | `/admin/feedback` sayfa render | ADR-012 |

---

### 7.1 Sesli Seans Başlatma + Roleplay Akışı

**Trigger:** Kullanıcı `/dashboard/sessions/[id]` sayfasında mikrofon butonuna basar.

**Aktörler:** End user (mikrofon), `VoiceSessionClient`, `activateSessionAction`, LLM (chat API stream), Whisper (STT), ElevenLabs (TTS), Silero VAD (browser).

**Precondition'lar:**
- Seans `pending` state'te, kullanıcıya ait.
- Mikrofon izni yok → ilk tıklamada istenir.
- `ELEVENLABS_API_KEY` + persona `voice_id` mevcut.

**Happy Path:**
1. **Sayfa mount** → `getActiveSessionData(id)` ile seans çekilir. `session.status === 'pending'` ama **aktivasyon otomatik tetiklenmez** (ADR-011 — A1 kararı). UI'da mikrofon butonu + "Başlatmak için mikrofona dokunun" mesajı.
2. **İlk mikrofon tıklaması:**
   - Mikrofon izni iste (`navigator.mediaDevices.getUserMedia`).
   - İzin reddedilirse → "Mikrofon izni olmadan seans başlatılamaz" mesajı, akış sonlanır.
   - İzin varsa → `activateSessionAction(sessionId)` çağrılır (sync).
     - `buildSystemPrompt(persona, scenario, rubric)` → system prompt üretir.
     - AES-GCM şifrelenip `prompt_logs`'a yazılır.
     - `sessions.status = 'active'`, `phase = 'opening'`.
3. **İlk LLM çağrısı — Persona "Merhaba" (A2 kararı):**
   - Chat API'ye user message `"__SESSION_START__"` gönderilir (özel init token).
   - System prompt'a "İlk yanıtında kısa bir selamlama yap: `Merhaba <kullanıcıAdı>` şeklinde başla, sonra karakterini kısaca tanıt." direktifi eklenir.
   - LLM stream başlar → chunk'lar TTS pipeline'a akıtılır (streaming TTS: ElevenLabs stream endpoint).
4. **TTS playback:**
   - İlk ~500ms chunk buffer → audio playback başlar.
   - Oynatma sırasında `turn = 'speaking'`.
5. **VAD dinlemeye geçer:**
   - Persona sesi bittiğinde `turn = 'listening'`.
   - Kullanıcı konuşursa VAD yakalar → Whisper'a gönderir → transcript döner → chat API'ye → LLM yanıt → TTS → ...
6. **Barge-in (kullanıcı AI'ı keserse):**
   - VAD `onSpeechStart` callback'i → `stopPlayback()` + abort mevcut LLM fetch + yeni tur başlat.

**Branch Conditions:**
- İlk aktivasyon hatası (persona/scenario/rubric bulunamadı) → seans `pending`'de kalır, UI error mesajı.
- Chat API SSE hata → `useSSERetry` 3 deneme, exponential backoff; 3 sonrası "Bağlantı kurulamadı, yeniden deneyin" butonu.
- TTS error → fallback: ses çalmadan metin chunk'ları UI'da 2. satır altında görünür (accessibility + debugging).
- Her 5 mesajda `QStash.publish('/api/sessions/[id]/summarize')` — §7.5 akışı tetiklenir (fire-and-forget).

**Faz Geçişleri:**
LLM yanıtına `[PHASE:opening|exploration|deepening|action|closing]` marker'ı eklenir. Client `updateSessionPhase(sessionId, newPhase)` ile `sessions.phase`'i günceller. UI'da `PhaseIndicator` componenti renkli etiket gösterir.

**Session End Trigger:**
- LLM `[SESSION_END]` marker'ı ürettiğinde → client `endSessionAction(sessionId, 'ai_ended')` çağırır → §7.3 akışı başlar.
- Kullanıcı "Seansı Bitir" butonuna basarsa → `endSessionAction(sessionId, 'user_ended')` → §7.3.
- Kullanıcı "Seansı Yarıda Kes" butonuna basarsa → §7.2.

**Failure Modes:**

| Aşama | Hata | Sistem davranışı | Kullanıcı görür | Recovery |
|---|---|---|---|---|
| Mikrofon izni | Reddedildi | Seans `pending`'de kalır | "Mikrofon izni gerekli" banner + "İzni Ver" buton | Tarayıcı ayarlarından aç, sayfa yenile |
| VAD init | ONNX model yükleme hatası | `useNaturalVoice` exception | "Ses sistemi başlatılamadı" error card | Sayfa yenile; fallback: manual push-to-talk button (Phase 3+) |
| STT | Whisper timeout / empty transcript | `isEmpty: true` döner | VAD tekrar dinleme moduna geçer | User yeniden konuşur |
| LLM streaming | OpenAI 5xx veya timeout | Session FAILED state'e geçer | "Koç yanıt veremedi, seansı yeniden başlat" | Seans cancel → yeni seans aç |
| TTS | ElevenLabs quota aşıldı | Audio çalmaz, metin görünür | "Ses şu anda kullanılamıyor" banner | Admin kontak; monitoring alert |
| Heartbeat | 60 sn yanıtsız | Session DROPPED (2h recovery window) | Bağlantı kesildi mesajı | Kullanıcı sayfaya dönerse `DroppedSessionRecovery` devreye girer |

---

### 7.2 Seansı Yarıda Kesme Akışı

**Trigger:** Kullanıcı header'daki "Seansı Yarıda Kes" butonuna basar (§7.1 aktif iken).

**Aktörler:** End user, `VoiceSessionClient`, `InterruptReasonModal`, `cancelSessionAction`.

**Precondition'lar:** Session `active` state'te.

**Happy Path:**
1. Kullanıcı "Seansı Yarıda Kes" butonuna basar → `InterruptReasonModal` açılır.
2. Modal 4 reason seçeneği sunar:
   - `technical_issue` — Teknik problem yaşadım
   - `persona_wrong_fit` — Persona beklediğim gibi değildi
   - `scenario_too_hard` — Senaryo zorlayıcıydı
   - `user_interrupted` — Başka bir sebeple devam edemem
3. Kullanıcı seçer ve "Onayla" basar → `cancelSessionAction(sessionId, reason)` çağrılır.
4. Server action:
   - `sessions.status = 'cancelled'`
   - `sessions.cancellation_reason = reason`
   - `sessions.cancelled_at = NOW()`
   - `sessions.duration_seconds = <started_at ile şimdi arası>`
5. **ÖNEMLI:** `scheduleEvaluationJob` ÇAĞRILMAZ. QStash'a hiçbir iş publish edilmez. AI değerlendirmesi yapılmaz.
6. Modal kapanır, kullanıcı `/dashboard/sessions`'a yönlendirilir.
7. Sonraki dashboard render'ında yarıda kesilen seans §7.1.C istatistik widget'larında görünür.

**Branch Conditions:**
- Kullanıcı modal'ı kapatırsa (X veya ESC) → seans `active` olarak devam eder.
- Seans zaten `completed` ise → "Seans zaten tamamlanmış" mesajı.

**Failure Modes:**

| Aşama | Hata | Davranış |
|---|---|---|
| `cancelSessionAction` DB error | Supabase transient | 1 retry; hâlâ başarısız → seans `active` kalır, banner "Kayıt yapılamadı, yeniden deneyin" |
| reason enum dışı değer | Zod validation | Modal'da hata mesajı |

**İstatistik Widget Veri Akışı:**
- `getUserInterruptedSessions(userId)` query:
  ```sql
  SELECT
    persona_id, persona_name,
    AVG(duration_seconds / 60) AS avg_interrupt_minutes,
    COUNT(*) AS interrupt_count,
    ARRAY_AGG(jsonb_build_object('session_id', id, 'scenario', scenario_title, 'duration', duration_seconds, 'cancelled_at', cancelled_at, 'reason', cancellation_reason) ORDER BY cancelled_at DESC) AS sessions
  FROM sessions s
  JOIN personas p ON p.id = s.persona_id
  LEFT JOIN scenarios sc ON sc.id = s.scenario_id
  WHERE s.user_id = $1 AND s.status = 'cancelled'
  GROUP BY persona_id, persona_name
  ```
- Dashboard widget: persona kartı → tıklanınca session listesi accordion.
- Tenant admin `/tenant/users/[id]` sayfasından aynı query'i `userId` parametresiyle çağırır (RLS: kendi tenant'ındaki kullanıcılar için erişim).

---

### 7.3 Debrief + Evaluation Paralel Akışı

**Trigger:** `endSessionAction(sessionId, reason)` — kullanıcı "Seansı Bitir" veya AI `[SESSION_END]` ile.

**Aktörler:** End user, `endSessionAction`, `DebriefSessionClient`, `scheduleEvaluationJob`, debrief LLM, rapor LLM (evaluation engine).

**Precondition'lar:** Seans `active`, en az 4 mesaj transcript'te.

**Happy Path:**
1. `endSessionAction` çağrılır:
   - `sessions.status = 'debrief_active'` (ADR-012 ile eklenen yeni state).
   - `sessions.completed_at = NOW()`, `sessions.duration_seconds` hesapla.
   - `scheduleEvaluationJob(sessionId)` → QStash publish (async, 5 sn delay).
2. Client `/dashboard/sessions/[id]` sayfası re-render → `debrief_active` state'inde `DebriefSessionClient` render edilir.
3. **Debrief LLM çağrısı:**
   - Farklı voice_id (ELEVENLABS_DEBRIEF_COACH_VOICE_ID) ile TTS.
   - System prompt: `debrief-prompt.builder.ts` tarafından üretilir:
     - Samimi ton, "rahat sohbet" modu
     - 4-5 açık uçlu feedback sorusu (D2 kararı: AI-driven)
     - Maksimum 6 tur (kullanıcı mesajı + AI yanıtı)
     - Kapanış direktifi: "[DEBRIEF_END]" marker'ı
4. Debrief mesajları **ayrı tabloya** yazılır: `debrief_messages` (session_messages değil).
5. Debrief TRANSCRIPT EVALUATION'A GİRMEZ (D3 kararı — amaç feedback toplamak, değerlendirmek değil).
6. Kullanıcı debrief boyunca 1-2 dk rahat sohbet eder.
7. AI `[DEBRIEF_END]` marker'ı üretir → `finishDebriefAction(sessionId)`:
   - `sessions.status = 'debrief_completed'`.
   - Evaluation hazır mı kontrol et (`evaluations` tablosunda kayıt var mı).
8. **Senkronizasyon mantığı (D4 + D5):**
   - Evaluation hazır → redirect `/dashboard/sessions/[id]/report`.
   - Evaluation henüz hazır değil → "Seans Raporunuzu Hazırlıyorum" bekleme ekranı:
     - Polling: 3 sn aralıklarla `isEvaluationReady(sessionId)` çağırır.
     - Maximum bekleme: 60 sn (O17 açık soru default'u).
     - 60 sn'de hâlâ hazır değilse → rapor sayfasına git, evaluation bölümü "Hazırlanıyor" placeholder gösterir.
9. Rapor sayfası açıldığında §7.4 akışı tetiklenir.

**Paralel Evaluation Akışı:**
- QStash 5 sn delay sonrası `POST /api/sessions/[id]/evaluate` çağırır.
- `runEvaluation(sessionId)`:
  - Transcript çek (decrypt).
  - `buildEvaluationPrompt` — seans transcript + rubric boyutları (ICF + custom if tenant aktive etmiş) → LLM prompt.
  - OpenAI `response_format: json_object`, `OPENAI_LLM_MODEL` env'i (aynı model — C3 kararı).
  - JSON parse → `evaluations` + `dimension_scores` INSERT.
- Tamamlandığında `evaluations.created_at` set edilir, §7.3.8 polling'i bunu yakalar.
- 3 retry başarısız → `evaluations.status = 'evaluation_failed'` → rapor sayfasında P2-002 "Yeniden dene" butonu.

**Branch Conditions:**
- Kullanıcı debrief sırasında sekmeyi kapatırsa → heartbeat kesilir → DROPPED state'e geçer (2 saat recovery). Dönerse debrief'e kaldığı yerden devam eder.
- Kullanıcı debrief'te hiç konuşmaz, sadece dinler → AI 3 soru sorar, kullanıcıdan yanıt gelmezse "Anladım, şimdi raporunuzu hazırlıyorum" + `[DEBRIEF_END]`.

**Failure Modes:**

| Aşama | Hata | Davranış |
|---|---|---|
| `scheduleEvaluationJob` hata | QStash down | Log uyarı, evaluation job DB tablosuna yazılır (`evaluation_queue_fallback`), cron ile retry edilir |
| Debrief LLM error | OpenAI 5xx | "Debrief atlanıyor, rapora yönlendiriliyorsunuz" — direkt rapor sayfasına |
| Debrief voice ID geçersiz | ElevenLabs 404 | Fallback: default persona voice ID |
| Evaluation 60 sn'de hazır değil | Cold start veya model delay | Rapor sayfası "Hazırlanıyor" state'te açılır; polling devam eder |

---

### 7.4 Sesli Rapor Sunumu Akışı

**Trigger:** Rapor sayfası (`/dashboard/sessions/[id]/report`) açılır + evaluation hazır.

**Aktörler:** End user, `SessionReportPage`, `generateReportAudioAction`, ElevenLabs TTS, Supabase Storage.

**Precondition'lar:** `evaluations` + `dimension_scores` kayıtları mevcut.

**Happy Path:**
1. Sayfa server component'i rapor verisini çeker (`getSessionReport(sessionId)`).
2. `session_report_audio` tablosunda kayıt var mı kontrol et:
   - **Var** → ses zaten hazır → `audioStoragePath`'i signed URL'e çevir → player'a ver.
   - **Yok** → `generateReportAudioAction(sessionId)` tetiklenir (client-side, sayfa yüklendikten sonra async).
3. `generateReportAudioAction` (server):
   - Rapor metni LLM ile inşa edilir (ayrı prompt):
     ```
     Sen bir koçluk değerlendirme asistanısın. Aşağıdaki seans değerlendirme verisini, 
     kullanıcıya sesli sunulacak şekilde, akıcı ve sıcak bir dille 1.5 dakikalık bir 
     metne dönüştür. Genel puanı METIN olarak söyleme. Ortalama karşılaştırmasını 
     kullan ("önceki 5 seansınızdan X puan yüksek/düşük"). Rubric boyutlarının en 
     düşük 3 tanesini detaylandır. Eğitim ve kitap önerilerini bitirişte ver.
     ```
   - Metin ElevenLabs TTS'e gönderilir (Turbo v2.5, debrief coach voice_id — farklı ses ile rapor anlatır).
   - MP3 blob → Supabase Storage `session-reports/{user_id}/{session_id}.mp3`.
   - `session_report_audio` INSERT.
   - Sayfa state güncellenir, player aktif olur.
4. Player: Otomatik oynatma başlar (E2 kararı: sadece dinleme modu, kontrol: play/pause + progress).
5. Kullanıcı tamamını dinler veya pause'lar.
6. Sayfanın metin kısmı TAM rapor bilgisini gösterir (skor, dimensions, strengths, development areas, coaching note, manager insight, training/book recommendations).

**Branch Conditions:**
- Kullanıcı rapor sayfasına tekrar gelir → ses zaten storage'da → direkt oynatılır (yeni TTS çağrısı yok — E2 kararı: kayıt tutulsun, tekrar dinlenebilir).
- Development plan güncellenmişse eğitim/kitap önerileri yeni plana göre gelir (§7.6).
- Rapor metni >5000 karakterse ElevenLabs çağrısı parçalara bölünür (chunked TTS, 2-3 parça concatenate).

**Failure Modes:**

| Aşama | Hata | Davranış |
|---|---|---|
| Rapor metni LLM error | OpenAI 5xx | Ses üretilmez, sayfada text-only rapor + "Sesli özet şu an kullanılamıyor, yeniden deneyin" butonu |
| ElevenLabs quota | 429 | Aynı — text-only fallback + admin alert |
| Storage upload error | Supabase 5xx | In-memory blob → geçici olarak oynat; "Kayıt başarısız, tekrar dinleyemezsiniz" uyarısı |
| Signed URL expire | 1 saat varsayılan | Re-fetch signed URL, player otomatik refresh |

---

### 7.5 Transcript Özetleme Background Worker (Her 5 Mesajda)

**Trigger:** `saveSessionMessage` helper'ı yeni mesaj kaydettikten sonra, **seans mesaj sayısı 5'in katıysa** QStash'a summarize job publish eder.

**Aktörler:** `saveSessionMessage`, QStash, `/api/sessions/[id]/summarize`, summary LLM.

**Happy Path:**
1. Kullanıcı 5., 10., 15., ... mesajı gönderir.
2. `saveSessionMessage` INSERT sonrası, mevcut mesaj sayısını hesapla; 5'e tam bölünüyorsa:
   ```ts
   QStash.publishJSON({
     url: `${APP_URL}/api/sessions/${sessionId}/summarize`,
     body: { sessionId, coversMessagesTo: currentCount },
     delay: 2 // 2 sn sonra çalıştır
   })
   ```
3. QStash 2 sn sonra endpoint'i çağırır.
4. Handler:
   - Signature doğrula.
   - Son 5 mesajı al (session_messages, `created_at DESC LIMIT 5`).
   - Önceki özet var mı (`session_summaries WHERE session_id = X ORDER BY summary_index DESC LIMIT 1`).
   - Summarize prompt:
     ```
     Sen bir koçluk seansı transkript özetleyicisisin. Aşağıdaki 5 mesajlık kısmı 
     özetle. Amacın: bir sonraki LLM çağrısının bu parçadan kritik bilgileri 
     kaybetmeden devam edebilmesi. Ama özellikle:
     - Koçun sorduğu güçlü sorular
     - Yansıtmalar / özetler
     - Danışanın ifade ettiği duygu / değişim / direnç
     - Anlaşma, aksiyon, taahhüt ifadeleri
     Bu 4 kategoride kanıt parçaları çıkar.
     JSON formatında döndür: {
       "summary": "...",
       "rubric_signals": {
         "listens_actively": ["..."],
         "evokes_awareness": ["..."],
         ...
       }
     }
     ```
   - LLM çağrı (OPENAI_LLM_MODEL, `response_format: json_object`).
   - JSON parse → `session_summaries` INSERT:
     ```sql
     INSERT INTO session_summaries (
       session_id, tenant_id, summary_index,
       covers_messages_from, covers_messages_to,
       encrypted_content, rubric_signals, created_at
     ) VALUES (...)
     ```
5. Sonraki chat API çağrısı:
   - `getSessionHistory` artık son 40 mesaj değil, **kümülatif özet + son 5 ham mesaj** döner.
   - Prompt structure:
     ```
     [SYSTEM_PROMPT - persona + scenario + rubric directives]
     
     [ÖNCEKI KONUŞMA ÖZETİ - summary_1]
     [ÖNCEKI KONUŞMA ÖZETİ - summary_2]
     ...
     [ÖNCEKI KONUŞMA ÖZETİ - summary_N]
     
     [SON 5 HAM MESAJ]
     user: ...
     assistant: ...
     ...
     
     [YENİ USER MESAJI]
     ```
6. Token tasarrufu: 40 mesaj × 100 token = 4000 token → N×150 özet + 5×100 = ~1250 token (70% azalma).

**Evaluation Etkisi (C3 kararı: rubric-aware):**
- Evaluation engine transcript çözdüğünde `session_summaries.rubric_signals`'i de okur → doğru boyutlara doğru kanıt atanır.
- Fallback: summaries boşsa ham mesajlar üzerinden çalışır (eski davranış).

**Failure Modes:**

| Aşama | Hata | Davranış |
|---|---|---|
| QStash publish | QStash down | `session_summaries_queue` tablosuna fallback; cron ile retry |
| Summarize LLM hata | OpenAI 5xx | 3 QStash retry; başarısızsa bu 5 mesaj "özetlenmedi", chat API fallback ile ham gönderilir |
| JSON parse hata | LLM kötü format | 1 retry farklı temperature; hâlâ başarısız → özet satırı atlanır |
| Şifreleme hata | ENCRYPTION_KEY yanlış | Migration/infra hatası, monitoring alert |

---

### 7.6 Development Plan Aggregate Worker

**Trigger:** Her evaluation tamamlandığında `/api/sessions/[id]/evaluate` handler'ın sonunda QStash publish.

**Aktörler:** Evaluation engine, QStash, `/api/users/[id]/development-plan/regenerate`, aggregate LLM.

**Precondition'lar:** Kullanıcının en az 1 completed evaluation'ı var.

**Happy Path:**
1. Yeni evaluation INSERT sonrası:
   ```ts
   QStash.publishJSON({
     url: `${APP_URL}/api/users/${userId}/development-plan/regenerate`,
     body: { userId, triggeredBy: { sessionId, evaluationId } },
     delay: 10 // 10 sn sonra (evaluation kesin commit olmuş olsun)
   })
   ```
2. Handler:
   - Throttle check: `user_development_plans.generated_at` son 24 saatte mi? (O23 kararı) → evet ise skip, log: "Plan güncel, re-generate atlandı".
   - Throttle OK → user'ın son 5 completed evaluation'ını çek (`evaluations` + `dimension_scores`).
   - Aggregate LLM prompt:
     ```
     Aşağıda bir kullanıcının son 5 koçluk seansı değerlendirmeleri yer alıyor. 
     Bu kullanıcı için kişiselleştirilmiş bir gelişim planı hazırla.
     Output JSON:
     {
       "top_strengths": ["güçlü yön 1", "güçlü yön 2"] (en tutarlı yüksek skorlu 2-3 boyut),
       "priority_development_areas": ["gelişim alanı 1", "..."] (en düşük skorlu veya en çok development_areas'da tekrarlanan 2-3 konu),
       "training_recommendations": [
         {"topic": "...", "format": "online course|workshop|book|podcast", "reason": "..."}
       ] (2-3 öneri, TR eğitim pazarına uygun),
       "book_recommendations": [
         {"title": "...", "author": "...", "reason": "..."}
       ] (2 kitap, Türkçe veya çevirisi erişilebilir),
       "coach_note": "kullanıcıya özel kısa motivasyon notu"
     }
     ```
   - LLM çağrı (OPENAI_LLM_MODEL).
   - `user_development_plans` UPSERT (kullanıcı başına 1 kayıt + `expires_at = NOW() + 30 days`).
3. Sonraki dashboard render'ında widget'lar bu veriyi gösterir.

**Branch Conditions:**
- Throttle nedeniyle skip → sessiz log.
- Kullanıcının <1 evaluation'ı varsa: plan yok, widget "En az 1 seans tamamlayın" CTA göster.
- 30 gün sonra (`expires_at < NOW()`): widget "Planınız 30+ gün eski, yeni seansla güncelleyin" uyarısı.

**Failure Modes:**

| Aşama | Hata | Davranış |
|---|---|---|
| LLM 5xx | OpenAI down | QStash 3 retry; başarısızsa önceki plan korunur; next evaluation'da yeniden dener |
| JSON parse | Kötü format | 1 retry; başarısızsa önceki plan korunur |
| Aggregate insufficient data | <1 evaluation | Plan yazılmaz; widget CTA gösterir |

---

### 7.7 Super Admin Feedback Review Akışı

**Trigger:** Super admin `/admin/feedback` sayfasını açar.

**Aktörler:** Super admin, `FeedbackPage`, `debrief_messages` + `persona_prompt_feedback` tabloları.

**Precondition'lar:** Kullanıcı `super_admin` rolünde.

**Happy Path:**
1. Sayfa server component debrief messages'ları çeker (tenant filter + persona filter + senaryo filter + date range).
2. Filter'lar:
   - Tenant (tüm tenant'lar veya seçilen)
   - Persona (tüm persona veya seçilen)
   - Senaryo (tüm veya seçilen)
   - Tarih aralığı (son 7/30/90 gün)
   - Status (open / applied / dismissed)
3. Her debrief transcript kartı:
   - Session metadata (persona adı, senaryo, kullanıcı rolü, tarih — kullanıcı adı/email MASKELENMIŞ, O18 kararı)
   - User message'lar listelenmiş (PII regex ile temizlenmiş)
   - "Not Ekle" butonu → inline textarea → `persona_prompt_feedback` INSERT.
   - Status değiştir: Open → Applied → Dismissed (prompt güncelleme workflow'u ileride).
4. Ayrı bir sayfa/sekme: "Persona Prompt Düzenlemesi Önerileri":
   - `persona_prompt_feedback WHERE status = 'open'` listelenir.
   - Super admin persona bazında öneri inceler, "Persona'yı Düzenle" → persona prompt editörüne yönlendirilir (Phase 3+).

**Branch Conditions:**
- Hiç debrief transcript yok → empty state.
- Filter sonucu boş → "Seçilen kriterlerde geri bildirim yok" mesajı.

**PII Maskeleme:**
- User message'lar regex ile filtrelenir:
  - `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g` → `[e-posta gizlendi]`
  - `/(\+90|0)?[0-9]{10}/g` → `[telefon gizlendi]`
  - `/[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s[A-ZÇĞİÖŞÜ][a-zçğıöşü]+/g` → potansiyel isim (işaretle, gösterme değil — ilk harfler: "A. Y.")

**Failure Modes:** Standart RLS + auth error handling.

---
