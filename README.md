# AION Mirror — roleplay-saas

Multi-tenant SaaS platform for AI-driven role-play coaching. End users run **voice** role-play sessions with AI personas to practice managerial conversations. After each session a different AI voice coach runs a 1-2 minute debrief while the evaluation engine generates a report in parallel; the report is then presented with a dedicated voice summary. Per-user development plans aggregate the last 5 sessions into actionable coaching insights and training/book recommendations.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** React 19, Tailwind CSS v4, shadcn/ui, Radix
- **Forms & validation:** react-hook-form + Zod
- **State:** Zustand (session + voice-session stores)
- **Database / Auth / Storage / Realtime:** Supabase (Postgres)
- **Background jobs:** Upstash QStash (evaluation pipeline)
- **AI services:** OpenAI Chat + Whisper STT, ElevenLabs TTS
- **Email:** Resend (SMTP — invite + OTP emails, sender: `noreply@mirror.aionmore.com`)
- **Testing:** Vitest + Playwright (installed; configs pending)

## Getting Started

```bash
npm install
cp .env.local.example .env.local    # fill in Supabase, OpenAI, QStash, ElevenLabs, encryption keys
npm run dev
```

Open http://localhost:3000.

> **Heads up:** `next.config.ts` pins `turbopack.root` to this directory. Do **not** create a `package.json` or `node_modules/` in any parent folder — it will break workspace detection.

## Project Documentation

| File | Purpose |
|---|---|
| `CLAUDE.md` | Architecture guide, conventions, current status, bug log (sesli seans katmanı 17 bug + fix), next-session work queue |
| `AGENTS.md` | Rules for AI coding agents working in this repo |
| `Gelistirme23Nisan/canli_yayina_cikis_plani_20260425.md` | **Aktif sprint** — 1 Mayıs 2026 launch planı |
| `Gelistirme23Nisan/Pre_Launch_Phase_1.md` | Persona roleplay sözleşmesi parametrikleştirme — Phase 1 (~4.5 saat, low-risk) |
| `Gelistirme23Nisan/Post_Launch_Phase_2.md` | Tam parametrik roleplay mimarisi — Phase 2 (mode preset + dinamik faz + evaluation target, ~2 hafta) |
| `Gelistirme23Nisan/Post_Launch_Iyilestirmeler.md` | Post-launch iyileştirme listesi (P1/P2/P3/R&D); STT upgrade, voice cloning, Realtime API değerlendirmesi |
| `Gelistirme23Nisan/mimari_kararlar_20260423.md` | 15 ADR (ADR-001..ADR-016; ADR-016 = parametrik roleplay) |
| `Gelistirme23Nisan/yol_haritasi_20260424.md` | Phased roadmap + sprint çıktıları |
| `Gelistirme23Nisan/akis_haritasi_20260423.md` | 13 workflow specs |
| `Gelistirme23Nisan/system_analiz_20260423.md` | Codebase map (ground truth) |
| `Gelistirme23Nisan/rubric_icf_20260424.md` | ICF 8 koçluk boyutu rubric tanımı |
| `Gelistime*.md`, `Gelistime4Kontrol.md` | Chronological development bug/change logs |

Start by reading `CLAUDE.md`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check (no dedicated script yet) |

## Role Hierarchy

Six additive roles: `user` → `manager` → `hr_admin` → `hr_viewer` → `tenant_admin` → `super_admin`. See `CLAUDE.md` → "Role Hierarchy" for access rules. Route protection is coarse-grained in `middleware.ts` and re-checked in layouts and server actions.

## Sesli Seans Katmanı — Düzeltilen Hatalar (2026-04-26 ✅)

Bu sprint kapsamında sesli seans akışındaki 6 kritik hata tespit edilip giderildi:

- **VAD-001 ✅** — Chrome Web Audio API graf optimizasyonu: `analyser → muteGain(gain=0) → destination` bağlantısıyla çözüldü.
- **VAD-002 ✅** — Zustand stale state → VAD erken başlatma: yerel `useState(false)` + greeting-sonrası aktifleşme.
- **STT-001 ✅** — Safari `audio/mp4` MIME uyumsuzluğu: `blobToWhisperFilename()` helper + STT route pass-through.
- **CHAT-001 ✅** — Barge-in/sayfa kapanma → session `failed`: `isClientAbort` detection, session korunuyor.
- **TTS-001 ✅** — Safari chunked MP3 sessiz hata: `synthesize()` full buffer + `Content-Length` header.
- **VOICE-001 ✅** — Persona `voice_id` DB'de var ama TTS route okumuyor: TTS route'a persona JOIN + adapter'a `voiceId` iletimi.
- **AUDIO-001 ✅** — `audio.play()` autoplay reddi: `useAudioPlayer` singleton element + user-gesture'da `unlock()`.
- **STT-PHANTOM-001 ✅** — Whisper Türkçe halüsinasyonları ("Altyazı M.K.", "Kut!" vb.): regex blacklist + min length + anti-prompt.
- **TTS-ECHO-001 ✅** — Hoparlör→mic echo VAD'ı tetikliyor: AEC constraint + TTS sırasında adaptive VAD threshold (0.005 → 0.030).
- **PROMPT-EARLYEND-001 ✅** — AI 5-6 turda `[SESSION_END]` basıyor: faz başına min tur sayısı + 13-tur kuralı.
- **END-001 ✅** — "Seansı Bitir" butonu sessiz fail: result check + `toast.error()` mesajı.
- **DEBRIEF-AUTOPLAY-001 ✅** — Debrief sayfasında sesli başlangıç yok (autoplay policy): auto-start kaldırıldı, "Geri bildirime başla" butonu eklendi (unlock pattern).
- **ROLE-INVERSION-001 ✅** — *(KRİTİK)* AI koç gibi davranıyordu (kullanıcıya soru soruyordu). Rubric+phase direktifleri AI'ı koç moduna sokuyordu. `roleReminder` bölümü eklendi, rubric/phase yeniden yazıldı, greeting trigger düzeltildi.
- **MARKER-LEAK-001 ✅** — "Phase Opening" bracket'sız faz ifadesi TTS'te sesli okunuyordu: regex genişletildi + naked phrase strip + client-side `sanitizeForTTS`.
- **END-RACE-001 ✅** — AI auto-end + user-end race → "Aktif seans değil" toast'u: özel error → `router.refresh()`.
- **STT-PHANTOM-002 ✅** — Türkçe "İ" phantom bypass: `toLocaleLowerCase('tr-TR')` ile JS lowercase'in Türkçe-uyumsuz davranışı düzeltildi.
- **CONTEXT-LOSSY-001 ✅** — Summarization lossy compression: eşik 5 → 50 mesaja çıkarıldı; küçük seanslar full history alıyor.
- **PROMPT-HALF-001 ✅** — AI yarım cümleleri tamamlıyordu: prompt'a "yarım cümle tamamlama, kısa onay ile sus" kuralı eklendi.
- **STT-PHANTOM-003 ✅** — YouTube outro phantom'ları ("abone olmayı unutmayın", "beğen butonuna tıkla"): 6 yeni regex pattern eklendi.
- **END-002 ✅** — `endSessionAction` enum hatası ("Seans Tamamlanamadı" toast): `cancellation_reason` UPDATE'ten kaldırıldı (semantik temizlik); migration 047 yedek olarak enum'u genişletti.
- **CANCEL-404-001 ✅** — Yarıda kesilen seans `/report` sayfasında 404 alıyordu: cancelled status için `/dashboard/sessions` listesine redirect.
- **UI-BADGE-001 ✅** — Status badge'ler light theme'de okunmuyordu (yazı/bg kontrast yetersiz): light+dark adaptive renkler + 9 status type tam destek.
- **UI-BADGE-002 ✅** — Çekirdek Badge `variant="outline"` site genelinde kırıktı (`border input` typo + light tema'da beyaz-üstü-beyaz yazı): typo düzeltildi, `text-primary-foreground` → `text-foreground`. Senaryo zorluk badge'i ve diğer tüm outline badge'leri artık görünür.
- **TTS-409-001 ✅** — AI [SESSION_END] sonrası final TTS isteği 409 alıyordu: server `active OR debrief_active` kabul ediyor, client 409'u sessizce yutuyor.
- **DEBRIEF-OPENING-001 ✅** — Debrief açılışı çok soğuk başlıyordu: prompt'a "0. AÇILIŞ" kuralı ("Merhaba ... değerlendirme hazırlanırken birkaç soru..."), trigger mesajı güncellendi.
- **EARLYEND-GUARD-001 ✅** — LLM prompt kuralına rağmen 6-7 turda `[SESSION_END]` gönderiyordu: server-side hard floor (msgCount < 16 ise marker yok sayılır).
- **DEBRIEF-LATENCY-001 ⚡** — Debrief açılış gecikmesi 5-10sn (kısmen iyileştirildi): `getUserMedia` + chat paralel; ~500-700ms tasarruf. Tam çözüm pre-canned greeting (P2 backlog).
- **UX-SIDEBAR-GAP-001 ✅** — Senaryo seçim sayfasında sidebar ile dark stage arasında light bg gap'i: wrapper'a dark gradient bg uygulandı, transition seamless.
- **UX-VOICE-LAYOUT-001 ✅** — Voice session screen CinematicPersonaStage stilinde yeniden tasarlandı: dark gradient bg sidebar'a kadar uzanır (gap kayboldu), sol kolon büyük persona avatar + fancy fonts + purple emotional badge + mic + frosted koçluk notu, sağ kolon canlı transkript akışı (purple chat bubbles, auto-scroll). Senaryo seçim ekranıyla görsel süreklilik sağlandı.
- **UX-SIDEBAR-CORE-001 ✅** — *(KRİTİK GLOBAL BUG, 3 iterasyon)* Site genelinde sidebar↔content gap'i. Kök neden: `display: block` peer-div'in flex auto-width'i ortama göre tutarsızdı. Nihai çözüm: peer-div'e `md:w-[--sidebar-width]` explicit width verildi, SidebarInset'ten state-bazlı `ml/pl` offset'i tamamen kaldırıldı.
- **UX-SIDEBAR-WIDTH-001 ✅** — Sidebar genişlik 5 iterasyonda dengelendi: `16 → 18 → 20 → 22 → 17rem` (mobile drawer 20rem).
- **UX-SIDEBAR-NESTED-001 ✅** — *(Yapısal kök fix)* Sidebar 3 kat iç içe yapı (outer peer-div + inner spacer + fixed div + bg-sidebar wrapper) flex layout'a tutarsızlık katıyordu. Tek `<aside>` element'ine indirgendi (`sticky top-0 + h-svh + explicit width + bg-sidebar`). Layout deterministik, leak imkansız.
- **UX-PERSONA-LAYOUT-001 ✅** — Persona/sahne ekranlarında zengin meta-veri görünümü: yeni `PersonaInfoColumn` component (foto üst + Deneyim/PersonaTipi/Zorluk/Direnç/İşbirliği/SenaryoBağlamı/KoçlukBağlamı/TetikleyiciTag'leri/KoçlukİpuçlarıKartı). `CinematicPersonaStage` ve `VoiceSessionClient` ortak component'i kullanıyor.
- **ENV-001 ✅** — `OPENAI_LLM_MODEL=gpt-5.4` (geçersiz model): kullanıcı `gpt-4o`'ya geçti.

⚠️ **Bekleyen:** `HISTORY-001` için migration `20260426_046_session_messages_align.sql` Supabase SQL Editor'da çalıştırılmalı. AI geçmişi bu migration olmadan çalışmıyor.

Detaylar: `CLAUDE.md` → "Hata Kaydı — Sesli Seans Katmanı".

---

## Current Status

**Phase 0–3 tamamlandı (2026-04-26). 1 Mayıs canlı yayın hedefi.**

**Çalışan sistemler:** Auth (OTP/passwordless), bulk upload, role sync, inactivity auto-logout, feature flags, Chat API (streaming + barge-in tolerant), TTS (ElevenLabs — Safari+Chrome), STT (Whisper — webm+mp4), VAD (Chrome+Safari), session activation, evaluation pipeline (QStash), debrief akışı, sesli rapor, transcript summarization, development plan aggregation, tüm dashboard sayfaları.

**Bekleyen tek iş:** Migration 046 (AI geçmişi şartı) — Supabase SQL Editor'da çalıştır.

For the full work log, confirmed product decisions, and architecture guide, see `CLAUDE.md`.
