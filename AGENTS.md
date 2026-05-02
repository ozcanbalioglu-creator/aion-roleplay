# AION Mirror / roleplay-saas Agent Notes

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses Next.js 16. APIs, conventions, and file structure may differ from older Next.js versions. Before changing App Router behavior, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices. In particular, `params` and `searchParams` page props are promises, and `next/dynamic` with `ssr: false` is not supported inside Server Components.
<!-- END:nextjs-agent-rules -->

## Project Shape

- Main app code lives under `src/app/(dashboard)`, `src/components`, `src/lib`, `src/modules`, and `src/types`.
- Supabase SQL migrations live in `supabase/migrations`.
- Supabase is used online; do not assume a local Supabase instance is available.
- Do not run local Supabase commands as part of normal verification. If a migration changes, make it safe to paste into the Supabase SQL Editor, preferably idempotent with `IF NOT EXISTS` or `DROP ... IF EXISTS` where appropriate.

## Commands

- `npm run lint` runs ESLint.
- `npm run build` runs the Next.js production build.
- There is no `npm run typecheck` script at the moment; use `npx tsc --noEmit` only when needed.

## Implementation Notes

- Prefer existing patterns in `src/lib/queries`, `src/lib/actions`, and colocated route components.
- Server actions should live under `src/lib/actions` and start with `'use server'`.
- Client components using hooks or browser APIs must start with `'use client'`.
- Keep RLS changes tenant-safe. For reporting roles, remember that Postgres RLS SELECT policies are permissive by default, so adding a narrower policy does not restrict an older broader one.
- Existing worktree changes may be user work. Do not revert unrelated modifications.
- **Doc update rule:** After every successfully completed task, update the relevant sections of `CLAUDE.md`, `AGENTS.md`, `README.md`, and `Gelistirme23Nisan/yol_haritasi_20260424.md`. No reminder needed — this is automatic.

## Agent Chain State (as of 2026-04-24 akşamı)

Analysis and planning chain is complete **through Phase 2 spec**. All products live in `Gelistirme23Nisan/`:

- `system_analiz_20260423.md` — Codebase Onboarding Engineer output (ground truth for file structure)
- `mimari_kararlar_20260423.md` — Software Architect + user decisions — **14 ADRs** (ADR-001..ADR-015; ADR-006 + ADR-009 Proposed, diğerleri Accepted)
- `akis_haritasi_20260423.md` — Workflow Architect output — **13 workflow specs** (§1-§6 app shell + §7-§13 AI Roleplay Core Flow)
- `yol_haritasi_20260424.md` — **Project Shepherd output** — phased roadmap Phase 0–3; Phase 2'de P2-100..P2-112 detaylı iş paketleri açık
- `rubric_icf_20260424.md` — ICF 8 koçluk boyutu + 1-5 puan kriterleri + custom rubric önerileri

When continuing work on this project:

- **Don't re-do onboarding.** `system_analiz_20260423.md` is ground truth for codebase structure. If unsure about a file's existence or role, check there first before reading code.
- **Don't re-open settled architectural decisions** unless a new hard constraint emerges. ADRs capture the trade-off; see `mimari_kararlar_20260423.md`.
- **Phase 2 decisions are finalized** (2026-04-24 spec session with user): voice-only (ADR-011), debrief (ADR-012), rubric-aware summarization (ADR-013), per-persona voice ID (ADR-014), development plan aggregation (ADR-015). Don't treat these as open questions.
- **Confirmed product decisions** are documented in `CLAUDE.md` under "Confirmed Product Decisions" and "Phase 2 Product Decisions" — respect them.
- **Active work queue:** P3-001..P3-004 + P3-006 + P3-007 tamamlandı. Kalan: P3-005 (opsiyonel klasör rename). Phase 3 esasen tamamlandı.
- **P1-Roleplay-001 (2026-05-01) UYGULANDI ✅:** Persona roleplay sözleşmesi parametrikleştirildi. `personas.roleplay_contract` ve `personas.opening_directive` kolonları (migration 052) + `DEFAULT_ROLE_CONTRACT` fallback + PersonaForm "Roleplay Sözleşmesi" kartı. Mevcut davranış birebir korundu (zero-regression). Detay: `CLAUDE.md` → "Hata Kaydı — 2026-05-01 ek". **Migration 052 staging DB'de uygulandı ✅ (2026-05-02 doğrulandı: 5 persona seed aldı, contract_len=1617, opening_len=295, test seansı + form CRUD smoke test başarılı).**
- **B1 (Header FOUC) ÇÖZÜLDÜ ✅ (2026-05-01):** Asıl kök neden `landing.css`'teki global `nav { ... }` element selector'ının dashboard sayfalarına leak etmesiydi. Fix: `.landing-root nav { ... }` ile scope'landı. Bonus: `app/layout.tsx` `<head>`'inde kritik inline CSS (`.fouc-md-flex`) defansif katman olarak korundu. Detay: `CLAUDE.md` → "LANDING-CSS-LEAK-001". **Mimari öğreni:** Global CSS dosyalarında element selector yazmamak; class selector kullanmak veya wrapper ile scope'lamak.

## Sesli Seans Katmanı — Bilinen Hatalar ve Çözümler (2026-04-26 ✅ TÜMÜ ÇÖZÜLDÜ)

Aşağıdaki hatalar bu sprint içinde tespit edilip giderildi. Detaylar `CLAUDE.md` → "Hata Kaydı — Sesli Seans Katmanı" bölümünde.

| ID | Sorun | Durum | Ana Dosya |
|---|---|---|---|
| VAD-001 | Chrome Web Audio API graf optimizasyonu — sıfır RMS | ✅ Çözüldü | `src/hooks/useNaturalVoice.ts` |
| VAD-002 | Zustand stale state → VAD erken başlatma | ✅ Çözüldü | `src/components/sessions/VoiceSessionClient.tsx` |
| STT-001 | Safari `audio/mp4` → `recording.webm` Whisper format reddi | ✅ Çözüldü | `src/lib/audio-utils.ts`, STT route+adapter |
| CHAT-001 | Barge-in abort → session `status='failed'` | ✅ Çözüldü | `src/app/api/sessions/[id]/chat/route.ts` |
| HISTORY-001 | `session_messages` schema mismatch → AI geçmişi kaybı | ✅ Çözüldü (migration 046 staging'de uygulandı, 2026-05-01 doğrulandı) | `message.service.ts`, migration 046 |
| TTS-001 | Safari chunked MP3 stream → sessiz hata | ✅ Çözüldü | `src/app/api/sessions/[id]/tts/route.ts` |
| VOICE-001 | Persona `voice_id` DB'de var ama TTS route okumuyor → kadın persona erkek sesle konuşuyor | ✅ Çözüldü | `src/app/api/sessions/[id]/tts/route.ts` |
| AUDIO-001 | `audio.play() reddedildi` — browser autoplay policy gesture chain bozulması | ✅ Çözüldü (singleton element + `unlock()` pattern) | `src/hooks/useAudioPlayer.ts`, `VoiceSessionClient.tsx` |
| STT-PHANTOM-001 | Whisper Türkçe halüsinasyonları ("Altyazı M.K.", "Kut!" vb.) phantom user mesajı olarak chat'e iletiliyor | ✅ Çözüldü (regex blacklist + min length + anti-prompt) | `src/app/api/sessions/[id]/stt/route.ts` |
| TTS-ECHO-001 | Hoparlör→mic echo VAD'ı tetikliyor → barge-in + Whisper phantom döngüsü | ✅ Çözüldü (AEC constraint + adaptive threshold) | `src/hooks/useNaturalVoice.ts` |
| PROMPT-EARLYEND-001 | AI 5-6 turda `[SESSION_END]` basıyor | ✅ Çözüldü (faz başına min tur + 13-tur kuralı) | `src/lib/session/system-prompt.builder.ts` |
| END-001 | "Seansı Bitir" butonu — `endSessionAction` hatası sessizce yutuluyor | ✅ Çözüldü (result check + toast.error) | `src/components/sessions/VoiceSessionClient.tsx` |
| DEBRIEF-AUTOPLAY-001 | Debrief auto-start, refresh sonrası autoplay reddediliyor | ✅ Çözüldü ("Geri bildirime başla" butonu + unlock pattern) | `src/components/sessions/DebriefSessionClient.tsx` |
| **ROLE-INVERSION-001** | **AI koç gibi davranıyordu — kullanıcıya soru soruyordu (rubric+phase direktifleri AI'ı koç moduna sokmuştu)** | ✅ Çözüldü (roleReminder + rubric/phase yeniden yazımı + greeting fix) | `system-prompt.builder.ts`, `VoiceSessionClient.tsx` |
| MARKER-LEAK-001 | "Phase Opening" gibi bracket'sız faz ifadeleri TTS'e sızıyor | ✅ Çözüldü (genişletilmiş regex + naked phrase strip + client-side sanitize) | `chat/route.ts`, `audio-utils.ts`, `VoiceSessionClient.tsx` |
| END-RACE-001 | AI auto-end + user-end race → "Aktif seans değil" toast'u | ✅ Çözüldü (özel error → router.refresh) | `VoiceSessionClient.tsx` |
| STT-PHANTOM-002 | Türkçe "İ" phantom filter'ı bypass ("İzlediğiniz için..." geçiyordu) | ✅ Çözüldü (`toLocaleLowerCase('tr-TR')`) | `src/app/api/sessions/[id]/stt/route.ts` |
| CONTEXT-LOSSY-001 | Summarization lossy compression — küçük seanslarda nuance kaybı | ✅ Eşik 5→50 mesaj (küçük seanslar full history alıyor) | `message.service.ts`, `chat/route.ts` |
| PROMPT-HALF-001 | AI yarım cümleleri tamamlayıp yönlendiriyor | ✅ Çözüldü (prompt'a "yarım cümle tamamlama" kuralı) | `system-prompt.builder.ts` |
| STT-PHANTOM-003 | YouTube outro phantom'ları ("abone ol", "beğen butonuna tıkla") | ✅ Çözüldü (6 yeni regex) | `stt/route.ts` |
| END-002 | `endSessionAction` enum hatası → "Seans Tamamlanamadı" | ✅ Çözüldü (`cancellation_reason` UPDATE'ten kaldırıldı + migration 047 yedek) | `session.actions.ts` |
| CANCEL-404-001 | Yarıda kesilen seans `/report`'a yönlendirip 404 alıyor | ✅ Çözüldü (cancelled → sessions list redirect) | `(dashboard)/dashboard/sessions/[id]/page.tsx` |
| UI-BADGE-001 | Status badge light theme'de okunmuyor (yazı/bg aynı renk) | ✅ Çözüldü (light+dark adaptive renkler + 9 status type'ı tamam) | `SessionStatusBadge.tsx`, `SessionList.tsx` |
| **UI-BADGE-002** | **Çekirdek Badge `variant="outline"` kırıktı (`border input` typo + `text-primary-foreground` light'da beyaz)** — tüm site'deki outline badge'leri etkiliyordu | ✅ Çözüldü (typo + text-foreground) | `src/components/ui/badge.tsx` |
| TTS-409-001 | AI [SESSION_END] gönderince status `debrief_active` oluyor; final TTS isteği 409 alıyor (console error) | ✅ Çözüldü (server `active OR debrief_active` + client 409 silent) | `tts/route.ts`, `VoiceSessionClient.tsx` |
| DEBRIEF-OPENING-001 | Debrief açılışı çok soğuk — direkt soru ile başlıyor | ✅ Çözüldü (prompt'a "0. AÇILIŞ" + trigger güncelleme) | `debrief-prompt.builder.ts`, `DebriefSessionClient.tsx` |
| EARLYEND-GUARD-001 | LLM prompt kuralını dinlemeyip 6-7 turda `[SESSION_END]` gönderiyor | ✅ Çözüldü (server-side hard floor: msgCount < 16 ise marker yok sayılır) | `chat/route.ts` |
| DEBRIEF-LATENCY-001 | Debrief açılış gecikmesi 5-10sn | ⚡ Kısmen çözüldü (getUserMedia + chat paralel; tasarruf ~500-700ms) | `DebriefSessionClient.tsx` |
| UX-SIDEBAR-GAP-001 | Senaryo seçim sayfasında sidebar ile stage arası light gap | ✅ Çözüldü (wrapper'a dark gradient bg) | `(dashboard)/dashboard/sessions/new/page.tsx` |
| UX-VOICE-LAYOUT-001 | Voice session ekranı çok minimal + bg-card/30 sidebar gap'i sürdürüyor | ✅ Çözüldü (CinematicPersonaStage stilinde dark gradient + 42/58 split + persona stage sol + transkript sağ; sidebar'a kadar uzanan dark bg) | `VoiceSessionClient.tsx`, `session.queries.ts`, `sessions/[id]/page.tsx` |
| **UX-SIDEBAR-CORE-001** | **Site genelinde sidebar ↔ content gap (flex layout belirsizliği — `display: block` peer-div'in width'i ortama göre değişiyordu)** | ✅ Çözüldü (peer-div'e `md:w-[--sidebar-width]` explicit width, SidebarInset'ten state-bazlı margin/padding offset'i kaldırıldı) | `src/components/ui/sidebar.tsx` |
| UX-SIDEBAR-WIDTH-001 | Sidebar genişlik iterasyonları (16→18→20→22→17rem) | ✅ Nihai: 17rem (yapısal fix sonrası absorbsiyon gereksiz) | `src/components/ui/sidebar.tsx` |
| **UX-SIDEBAR-NESTED-001** | **Sidebar 3 kat iç içe yapı (outer peer-div + inner spacer + fixed div + bg-sidebar wrapper) flex layout'a tutarsızlık katıyor, light strip leak'lere yol açıyordu** | ✅ Tek `<aside>` element'ine indirgendi (sticky top-0 + h-svh + explicit width + bg-sidebar) | `src/components/ui/sidebar.tsx` |
| UX-PERSONA-LAYOUT-001 | Sahne ekranlarında persona meta-verisi yetersiz, sadece foto+name | ✅ PersonaInfoColumn (foto+kartlar: deneyim, persona tipi, zorluk/direnç/işbirliği, senaryo bağlamı, koçluk bağlamı, tetikleyici tag'leri, koçluk ipuçları) | `PersonaInfoColumn.tsx` (yeni), `CinematicPersonaStage.tsx`, `VoiceSessionClient.tsx`, `session.queries.ts`, `sessions/[id]/page.tsx` |
| ENV-001 | `OPENAI_LLM_MODEL=gpt-5.4` (mevcut değil) → session `failed` | ✅ Kullanıcı `gpt-4o` olarak düzeltti | `.env.local` |

**HISTORY-001 not:** Migration `20260426_046_session_messages_align.sql` staging DB'de uygulandı (2026-05-01 doğrulandı: `content`, `metadata`, `sequence_number` kolonları aktif). AI geçmişi sağlıklı çalışıyor. Bu blocker artık yok.

**VAD-001 teknik özeti:**
- Chrome, Web Audio API grafını destination'a bağlı olmadığında optimize edip durduruyor (`MediaStreamAudioSourceNode` sessizleşiyor).
- Fix: `analyser → muteGain(gain=0) → ctx.destination`. Echo yok, graf canlı kalıyor.
- Safari testi kök nedeni kanıtladı: Safari'de VAD çalışıyordu, Chrome'da sıfır RMS.

**STT-001 teknik özeti:**
- Safari, MediaRecorder ile `audio/mp4` üretir (webm desteklemez).
- `blobToWhisperFilename(blob)` → blob MIME tipinden Whisper uzantısı türetir.
- STT route + adapter zinciri `filename`/`mimeType` pass-through yapıyor.

**VOICE-001 teknik özeti:**
- `personas.voice_id` (migration 032) DB'de mevcut ama session TTS route'u hiç okumuyordu → kadın persona dahi `ELEVENLABS_DEFAULT_VOICE_ID` (default erkek) ile konuşuyordu.
- Fix 1: TTS route'unda `persona:personas(voice_id)` JOIN'i + adapter'a `{ voiceId }` iletimi.
- Fix 2: `PersonaForm` sağ kolonuna "Ses Ayarı" kartı + `voice_id` input alanı; `persona.actions.ts` Zod schema/insert/update bu alanı yazıyor.
- **Yetki:** Voice ID atama super_admin only (ElevenLabs hesabı platform katmanında). Tenant admin voice seçmez. `createPersonaAction`/`updatePersonaAction` zaten role gated.

**AUDIO-001 teknik özeti:**
- Browser autoplay policy: `audio.play()` user-gesture chain içinde olmalı; chat+TTS await'leri (~3-5sn) gesture'ı tüketiyordu.
- Fix: `useAudioPlayer` singleton `HTMLAudioElement` reuse + `unlock()` (sessiz WAV data URI'yi mute olarak çalıp eleman'ı primed yapma).
- `VoiceSessionClient.handleToggleActive`'in BAŞINDA (await'ten önce, gesture içinde) `unlock()` çağrılıyor.
- Browser-agnostic: feature detection değil, davranışsal pattern; tüm modern browser'larda çalışır.

## Known Scope Notes

- **Bulk user upload (CSV/XLSX) — IMPLEMENTED.** Columns: `Ad Soyad`, `E-posta`, `Rol`, `Departman`. Uses `supabase.auth.admin.inviteUserByEmail()` — no passwords. Excel template with Rol dropdown at `GET /api/templates/users`. Component: `BulkUploadSheet`. Action: `bulk-upload.actions.ts`.
- **User management page (`/tenant/users`):** `tenant_admin` → full CRUD. `hr_admin` + `manager` → read-only list (no action buttons, no role dropdown).
- **Auth flow:** Invite → magic link email → consent → OTP login (no passwords). Auth callback handles both PKCE (`?code=`) and token_hash (`?token_hash=&type=invite`) flows.
- **Email:** Resend SMTP, sender `noreply@mirror.aionmore.com` (verified domain). Configured in Supabase Auth → SMTP.
- **AI Roleplay Core Flow (Phase 2 — büyük ölçüde IMPLEMENTED):** Voice-only (P2-100 ✅). `SessionClient.tsx` silindi. Mikrofon butonu ile başlar → persona "Merhaba" → debrief → sesli rapor → dev plan async. P2-103 (istatistik widget) açık; geri kalan P2-100..P2-112 tamamlandı. `hr_admin` artık `getUserReportData` canView listesinde. `UserTable` name sütunu `/tenant/users/[id]` linkli. Detaylar: `yol_haritasi_20260424.md`.
- **ICF Rubric — IMPLEMENTED (P2-109 ✅):** `rubric_icf_20260424.md` — 8 boyut × 1-5 puan. Migration `20260425_031_icf_rubric_seed.sql` DB'de çalıştırıldı. `rubric_templates.is_locked` kolonu eklendi.
- **Persona name unification — IMPLEMENTED:** Single `name` field (full display name like "Murat Kaya"). `first_name`, `last_name`, `surname` kaldırıldı. Migration `20260425_030_persona_name_unification.sql`.
- **Persona voice_id — IMPLEMENTED (P2-110 partial ✅):** `personas.voice_id TEXT` kolonu eklendi (migration `20260425_032_persona_voice_id.sql`). Gerçek ElevenLabs voice ID'leri henüz atanmadı (P2-110 kapsam devamı).
- **Feature flags** (Phase 1 P1-003): `progressPage`, `notificationsPage`, `managerPages` flags default `false`; placeholder pages call `notFound()` when flag is off; nav items filtered via `getNavSections(role, flags)`.
- **Route cleanup** (Phase 1 P1-002): Stale `src/app/(dashboard)/sessions/new/` removed. Only `/dashboard/sessions/new` exists. Empty `src/modules/*/` have README files.
- **Role sync** (Phase 0 P0-005): `src/lib/auth/role-sync.ts` — `syncUserRoleToJwt()` updates JWT metadata + writes audit log. `updateUserRoleAction` calls it then force-signs-out the user via Supabase REST Admin API.
- **Inactivity auto-logout** (Phase 1 P1-008): `src/hooks/useIdleTimeout.ts` + `idleTimeoutManager.ts` — 30 min idle → warning modal → 5 min countdown → auto sign-out. Cross-tab sync via `BroadcastChannel`.
- **Folder name `AIUON MIRROR`** contains a space — Phase 0 reproducibility candidate for rename.

## Phase 2 Implementation Order (P2-100 serisi)

Suggested dependency-aware order:

1. ✅ **P2-109** (ICF + custom rubric seed) ve **P2-110** (persona + voice ID seed) — DONE.
2. ✅ **P2-100** (text modu kaldır) — DONE.
3. ✅ **P2-101** (mikrofon başlatma + Merhaba) — DONE.
4. ✅ **P2-102** ("Yarıda Kes" buton + modal) ve **P2-104** (özetleme worker) — DONE.
5. ✅ **P2-105** (debrief akışı) + **P2-106** (super admin feedback) + **P2-107** (sesli rapor) + **P2-108** (dev plan) — DONE.
6. ✅ **P2-111** (`/tenant/users/[id]` kişi detay dashboard) + **P2-112** (dashboard/profilim widget güncellemeleri) — DONE.
7. ✅ **P2-103** (istatistik widget'ları) — DONE. Phase 2 tamamlandı.
6. **P2-107** (sesli rapor) → **P2-108** (development plan aggregate).
7. **P2-111** (kişi detay dashboard) + **P2-112** (dashboard/profilim widget'ları) — paralel, son.

## Phase 2 Env Additions

Yeni environment variables (Phase 2'de `.env.local.example` + prod'a eklenecek):

- `ELEVENLABS_DEBRIEF_COACH_VOICE_ID` — Debrief koçu için ayrı voice ID.
- Her persona için voice ID `personas.voice_id` kolonunda (env değil, DB).
- Tüm diğer env'ler zaten mevcut.
