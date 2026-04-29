# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Hata Kaydı — 2026-04-29 İkinci Tur

### EVAL-SCHEMA-MISMATCH-001 — Evaluation Hiç Oluşmuyordu (ÇÖZÜLDÜ ✅)

**Kök neden (3 katmanlı schema-code mismatch):**

1. **`evaluations.rubric_template_id NOT NULL`** — Migration 008'de zorunlu kolon, ama `runEvaluation` insert'inde hiç verilmiyordu. Her insert constraint violation ile silently fail oluyordu. QStash 3 retry da aynı yere düşüyor, `evaluation_failed` upsert bile rubric_template_id istediği için yazılamıyordu. Sonuç: hiç evaluation row yok → `getSessionReport` null dönüyor → "Rapor Hazırlanıyor veya Erişilemiyor" UI.

2. **`dimension_scores` yanlış kolon adları** — Şema: `evaluation_id, dimension_code, score, evidence_quotes, rationale, improvement_tip`. Kod yazıyordu: `session_id (yok), tenant_id (yok), evidence (yanlış ad), feedback (yanlış ad)`. Hem insert hem `getSessionReport` nested join fail oluyordu. PostgREST nested join'inde tek bir kolon eksikse tüm sorgu null döner — bu da NULL UI'ın asıl tetikleyicisiydi.

3. **`rubric_dimensions.dimension_name` yok, `name` var** — Migration 026'da `name` kolonu eklendi ama 5+ yerde hâlâ `dimension_name` kullanılıyordu (`system-prompt.builder`, `dashboard.queries`, `reports.queries`, `report-audio` route, `development-plan/regenerate` route).

**Uygulanan fix'ler:**
- `buildEvaluationPrompt` artık `rubricTemplateId` döndürüyor; engine insert'ine eklendi + `status: 'completed'` set ediliyor.
- `dimension_scores` insert artık doğru kolonlar (`evaluation_id, dimension_code, score, evidence_quotes, improvement_tip, rationale`).
- `getSessionReport` nested join düzeltildi; report page rendering kolonları okuyor.
- Tüm `dimension_name` referansları `name` olarak değiştirildi.
- `dashboard.queries` ve `reports.queries`'de `.in('session_id', ...)` yerine iki adımlı join: önce evaluation_id'leri çek, sonra dimension_scores'a bağla.

**Bonus:** runEvaluation'a kapsamlı step-by-step log eklendi (`[runEvaluation] START/session OK/transcript OK/prompt OK/LLM OK/JSON OK/insert OK/DONE`). Vercel function log'larında hangi adımda patladığı tek bakışta görülür.

**Bonus 2:** `usage_metrics` ve `prompt_logs` insert'leri non-fatal try-catch'e alındı. Bu tablolar fail olsa bile evaluation row korunur ve idempotency çalışır.

**Bonus 3:** `runEvaluation` idempotency check `.single()` → `.maybeSingle()` + `status === 'completed'` filter. Yarım kalmış evaluation varsa retry tetiklenebilir.

**İlgili dosyalar:** `src/lib/evaluation/evaluation-prompt.builder.ts`, `src/lib/evaluation/evaluation.engine.ts`, `src/lib/queries/evaluation.queries.ts`, `src/lib/queries/dashboard.queries.ts`, `src/lib/queries/reports.queries.ts`, `src/lib/session/system-prompt.builder.ts`, `src/app/api/sessions/[id]/report-audio/route.ts`, `src/app/api/users/[userId]/development-plan/regenerate/route.ts`, `src/app/(dashboard)/dashboard/sessions/[id]/report/page.tsx`

---

### MARKER-LEAK-DEBRIEF-002 — `[]` ve `[BİTİŞ]` gibi marker varyantları UI'a sızıyor (ÇÖZÜLDÜ ✅)

**Kök neden:** Marker strip regex'leri `[DEBRIEF_END]` ve `DEBRIEF_END` (naked) varyantlarını yakalıyordu ama LLM bazen `[]` (sadece boş bracket), `[BİTİŞ]` (Türkçe çeviri), `[end]` (kısaltma) gibi başka varyantlar üretiyordu. Kullanıcı debrief mesajının sonunda `[]` görmeye başladı.

**Uygulanan fix:** Mesajın **sonunda** ≤30 karakterlik bracket varsa marker olarak kabul edip strip eden defansif regex eklendi: `/\s*\[[^\[\]]{0,30}\]\s*$/`. Hem server final flush'ında hem client tarafında uygulanıyor. Ortadaki bracket'ler korunuyor (legitimate kullanım için).

**İlgili dosyalar:** `src/app/api/sessions/[id]/debrief/chat/route.ts`, `src/components/sessions/DebriefSessionClient.tsx`

---

### UX-DEBRIEF-MONOTONY-001 — Debrief Koçu Hep Aynı Cümlelerle Açıyor (ÇÖZÜLDÜ ✅)

**Kullanıcı geri bildirimi:** "Birkaç seans yapan kişiler hep aynı başlangıç, aynı kalıp cümlelerle karşılaştıkları için sıkılabilirler."

**Kök neden:** `debrief-prompt.builder.ts` çok katı bir açılış formu dayatıyordu — örnek cümle neredeyse harfiyen kullanılıyordu: "Merhaba Özcan, nasılsınız? Seans değerlendirme analiziniz hazırlanırken birkaç soru sormak istiyorum...". Aynı kullanıcı tekrar geldiğinde aynı diyalog tekrarı.

**Uygulanan fix:** Prompt yeniden yazıldı:
- **5 farklı açılış yaklaşımı:** samimi-dolaysız / kişisel-ilgili / sade-direkt / gözlemci-empatik / meraklı-açık. LLM rastgele birini seçer ve doğal hale getirir.
- **4 kategoride 3 alternatifli soru havuzu:** duygu/iz, zorlanma/içgörü, bağlantı, ileriye dönük. Her seansda farklı kombinasyon.
- **4 farklı kapanış varyantı.**
- "ÇEŞİTLİLİK KURALI" başlığı altında açıkça uyarı: "Aynı kullanıcı tekrar gelirse seçimini değiştir."

**İlgili dosyalar:** `src/lib/session/debrief-prompt.builder.ts`

---

### STT-PHANTOM-DEBRIEF-OBSERVATION-001 — Debrief Halüsinasyonları (RAPOR EDİLDİ, İZLEME)

**Gözlem (2026-04-29):** Kullanıcı debrief sırasında bazen söylemediği bir mesajın transkripte düştüğünü rapor etti. Test seansının ekran görüntüsünde phantom mesaj net görünmedi (kullanıcı kendi mesajıyla AI cevabını karıştırmış olabilir) ama kullanıcı raporu güvenilir.

**Olası nedenler:**
1. Debrief STT route'u (`/api/sessions/[id]/stt`) zaten phantom filter'a sahip ama Whisper'ın yeni Türkçe phantom örüntüleri çıkıyor olabilir.
2. Echo: TTS oynarken mic açık, geri kaçan ses Whisper'a gidiyor olabilir.

**Aksiyon:** Yeni phantom örnekleri toplandığında `WHISPER_PHANTOM_PATTERNS`'e eklenecek. Şu an post-launch izleme listesinde — production launch sonrası gerçek kullanıcı verisiyle pattern havuzu genişletilebilir.

**İlgili dosyalar:** `src/app/api/sessions/[id]/stt/route.ts`

---

## Hata Kaydı — Sesli Seans Katmanı (2026-04-26) — TÜMÜ ÇÖZÜLDÜ

### VAD-001 — Mikrofon Ses Algılaması (ÇÖZÜLDÜ ✅)

**Kök neden:** Chrome Web Audio API graf optimizasyonu — destination'a bağlı olmayan graflar üzerinde `MediaStreamAudioSourceNode` veri üretmiyor. Safari testi bu kök nedeni kesinleştirdi (Safari'de VAD çalışıyordu; Chrome'da sıfır RMS geliyordu).

**Uygulanan fix'ler:**
1. `useNaturalVoice.ts` — `analyser → muteGain(gain=0) → ctx.destination` bağlantısı eklendi. 0-gain echo'yu önler, destination bağlantısı grafı canlı tutar.
2. `ScriptProcessorNode` (deprecated, Chrome'da sıfır veri) → `AnalyserNode` + `MediaRecorder` mimarisine geçildi.
3. `pickSupportedMimeType()` — webm öncelikli, Safari için `audio/mp4` fallback.

**İlgili dosyalar:** `src/hooks/useNaturalVoice.ts`

---

### VAD-002 — VAD Premature Start / Zustand Stale State (ÇÖZÜLDÜ ✅)

**Kök neden:** Zustand `isActive` stale kalıyordu; React `reconnectPassiveEffects` VAD'ı mount sırasında başlatıyordu — kullanıcı mikrofon butonuna basmadan önce.

**Uygulanan fix:** `VoiceSessionClient.tsx`'te `const [vadEnabled, setVadEnabled] = useState(false)` yerel state eklendi. VAD yalnızca şu sırayla aktifleşiyor: kullanıcı mikrofon butonuna basar → greeting + TTS tamamlanır → `setVadEnabled(true)`. Zustand'a bağımlılık ortadan kalktı.

**İlgili dosyalar:** `src/components/sessions/VoiceSessionClient.tsx`

---

### STT-001 — Safari MIME Uyumsuzluğu (ÇÖZÜLDÜ ✅)

**Kök neden:** Safari MediaRecorder `audio/mp4` üretir (webm desteği yok). Biz her zaman `recording.webm` adıyla STT'ye gönderiyorduk; Whisper dosya uzantısından format çıkardığı için içerik redddediliyordu.

**Uygulanan fix'ler:**
1. `src/lib/audio-utils.ts` — `blobToWhisperFilename(blob)`: blob'un gerçek MIME tipinden Whisper-uyumlu uzantı türetir (`.webm`, `.mp4`, `.mp3`, `.ogg`, `.wav`).
2. `src/app/api/sessions/[id]/stt/route.ts` — gelen blob'un `name` ve `type`'ını yakalayıp adapter'a pass-through eder.
3. `src/adapters/stt/{interface.ts, openai.adapter.ts}` — `STTOptions`'a `filename` ve `mimeType` eklendi.
4. `VoiceSessionClient.tsx + DebriefSessionClient.tsx` — STT'ye `blobToWhisperFilename(audioBlob)` ile dinamik filename gönderiliyor.

---

### CHAT-001 — Client Abort → Session 'failed' (ÇÖZÜLDÜ ✅)

**Kök neden:** Barge-in veya sayfa kapatma → client tarafında SSE bağlantısı kesiliyor → server catch bloğu hata görüyor → `session.status = 'failed'` yazıyordu. Seans kullanılamaz hale geliyordu.

**Uygulanan fix:** `src/app/api/sessions/[id]/chat/route.ts` — catch bloğuna `isClientAbort` tespiti eklendi. `AbortError`, `ResponseAborted` ve `aborted|closed` pattern'leri client-initiated olarak tanınıyor; session korunuyor, sessizce kapanıyor.

---

### HISTORY-001 — AI Konuşma Geçmişini Kaybetme (ÇÖZÜLDÜ ✅ — migration 046 bekleniyor)

**Kök neden (iki katmanlı):**

1. **DB Schema uyumsuzluğu:** `session_messages` tablosu migration 007'de `content_encrypted` kolonu ile oluşturulmuş; kod `content` adını kullanıyordu. Ayrıca `sequence_number` ve `metadata` kolonları hiç eklenmemişti. Supabase sessizce fail ediyordu → tüm mesajlar kayboluyordu → AI her sorguda sıfırdan başlıyordu (kendini yeniden tanıtıyordu).

2. **Query bug:** `message.service.ts`'te `getSessionHistoryWithSummary()`, özet sonrası mesajları `range(afterIndex, afterIndex+4)` ile alıyordu — bu ROW POSITION pagination'dır, `sequence_number` filter'ı değil. Sonuç: konuşma uzayınca hep ilk 5 mesaj dönüyordu.

**Uygulanan fix'ler:**
1. **`supabase/migrations/20260426_046_session_messages_align.sql`** (YENİ — DB'de çalıştırılması gerekiyor):
   - `content_encrypted` → `content` rename (idempotent DO $$ bloğu)
   - `metadata JSONB` kolonu eklendi
   - `sequence_number INTEGER` eklendi + BEFORE INSERT trigger (otomatik monotonically artan)
   - Mevcut satırlar için `created_at` sırasına göre sequence dolduruldu
   - `NOTIFY pgrst, 'reload schema'` ile PostgREST cache yenilendi
2. **`src/lib/session/message.service.ts`** — `range()` yerine `.gt('sequence_number', afterIndex).order('sequence_number', { ascending: false }).limit(5)` + reverse.

> **⚠️ Kritik:** Migration 046 Supabase SQL Editor'da çalıştırılmadığı sürece AI geçmişi hâlâ çalışmıyor. Bu, seans kalitesi için en yüksek öncelikli bekleyen işlemdir.

---

### TTS-001 — Safari'de TTS Sesi Gelmiyor (ÇÖZÜLDÜ ✅)

**Kök neden:** ElevenLabs TTS route `Transfer-Encoding: chunked` ile `audio/mpeg` stream'i döndürüyordu. Safari, `Content-Length` olmadan chunked MP3 stream'ini decode edemiyor — sessizce başarısız oluyordu.

**Uygulanan fix:** `src/app/api/sessions/[id]/tts/route.ts` — `stream()` → `synthesize()` (full buffer) geçişi. Response artık `Content-Length` header ile tam buffer döndürüyor. Hem Safari hem Chrome'da güvenilir çalışıyor.

---

### VOICE-001 — Persona Voice ID DB'den TTS'e Akmıyor (ÇÖZÜLDÜ ✅)

**Kök neden:** `personas.voice_id` kolonu DB'de mevcut (migration 032) ama `src/app/api/sessions/[id]/tts/route.ts`, persona kaydını hiç okumadan adapter'ı `tts.synthesize(text)` ile çağırıyordu. Adapter da `process.env.ELEVENLABS_DEFAULT_VOICE_ID`'e fallback yapıyordu. Sonuç: kadın persona seçilse de hep aynı default ses (genellikle erkek) döndü; SaaS bağlamında her tenant'ın persona-spesifik sesleri kullanması imkânsızdı.

**Uygulanan fix'ler:**
1. **TTS route (`src/app/api/sessions/[id]/tts/route.ts`)**: session sorgusunda `persona:personas(voice_id)` JOIN'i ile persona'nın voice ID'sini çekiyor; `tts.synthesize(text, { voiceId: personaVoiceId })` ile adapter'a iletiyor. Persona'nın `voice_id` NULL ise adapter env default'a düşüyor.
2. **PersonaForm (`src/components/admin/PersonaForm.tsx`)**: Sağ kolona "Ses Ayarı" kartı eklendi — `voice_id` input alanı (Voice Library'den kopyalanan ElevenLabs voice ID).
3. **persona.actions.ts**: Zod schema'ya `voice_id` eklendi (max 100 char, opsiyonel); insert/update sorguları persona kaydına yazıyor.

**Yetkilendirme kararı:** Voice ID atama **super_admin only**. Tenant admin'ler voice seçmez çünkü ElevenLabs hesabı platform katmanında (super admin'in ElevenLabs aboneliği). `createPersonaAction` ve `updatePersonaAction` zaten `user.role !== 'super_admin'` ise `Yetkiniz yok` döndürüyor.

**İlgili dosyalar:** `src/app/api/sessions/[id]/tts/route.ts`, `src/components/admin/PersonaForm.tsx`, `src/lib/actions/persona.actions.ts`

> **Test için:** Super admin olarak `/tenant/personas/[id]/edit` sayfasından her personaya uygun voice ID gir (kadın persona → kadın voice, erkek persona → erkek voice). Voice ID'leri `https://elevenlabs.io/app/voice-library` adresinden kopyala.

---

### AUDIO-001 — Browser Autoplay Policy → `play() reddedildi` (ÇÖZÜLDÜ ✅)

**Kök neden:** Browser autoplay policy (özellikle Safari ve Chrome'un yeni sürümleri) `audio.play()`'i sadece "user gesture chain" içinde izin veriyor. Akışımızda kullanıcı mikrofon butonuna basıyor → ~3-5sn await chain (mic permission + chat SSE streaming + TTS sentezi) → `new Audio(url).play()`. Bu süreden sonra browser gesture'ı tüketilmiş sayıp çağrıyı reddediyordu. Hata: *"The request is not allowed by the user agent or the platform in the current context"*.

**Uygulanan fix:**
1. `src/hooks/useAudioPlayer.ts` yeniden yazıldı — singleton `HTMLAudioElement` (her seferinde `new Audio()` yerine tek element reuse). `iOS Safari` için `playsinline` attribute'u set edildi.
2. `unlock()` fonksiyonu eklendi: kullanıcı jesti içinde SENKRON çağrılınca, sessiz bir WAV data URI'yi `muted` olarak oynatıp eleman'ı "primed" hâle getiriyor. Aynı element üzerinden sonraki tüm `playBlob()` çağrıları autoplay engeline takılmıyor.
3. `VoiceSessionClient.tsx` — `handleToggleActive`'in başında (await'lerden ÖNCE) `unlockAudio()` çağrılıyor.

**İlgili dosyalar:** `src/hooks/useAudioPlayer.ts`, `src/components/sessions/VoiceSessionClient.tsx`

> **Not:** DebriefSessionClient'ta debrief auto-start oluyor (kullanıcı butonu yok); page refresh sonrası gesture chain kopuyor. Şu an için sorun raporlanmadı; raporlanırsa "Geri bildirime başla" butonu eklenebilir.

---

### STT-PHANTOM-001 — Whisper Türkçe Halüsinasyonları (ÇÖZÜLDÜ ✅)

**Kök neden:** OpenAI Whisper-1 modeli YouTube altyazı kredilerinden öğrenilmiş; boş/sessiz/çok kısa Türkçe ses gönderildiğinde "Altyazı M.K.", "Çeviri ve Altyazı M.K.", "Türkçe altyazı...", "Kut!" gibi phantom transkriptler üretiyor. Bu phantom'lar chat API'ye "kullanıcı mesajı" olarak iletilince AI bağlamı kaybediyor, kendini yeniden tanıtmaya başlıyor, konuşma akışı kopuyor.

**DB analizi (seans cc369651...):** 30 mesajlık tek bir seansta 7 phantom transkript tespit edildi (`#5 Altyazı M.K.`, `#7 Kut!`, `#9 Altyazı M.K.`, `#11 Çeviri ve Altyazı M.K.` vs.). AI bu phantom'lara cevap vermeye çalışırken `phase: exploration → opening` geriye düştü, kendini yeniden tanıttı.

**Uygulanan fix'ler:**
1. **`src/app/api/sessions/[id]/stt/route.ts`** — `WHISPER_PHANTOM_PATTERNS` regex listesi (Altyazı M.K., Çeviri, Türkçe altyazı, Kut, izlediğiniz için teşekkürler...) + `MIN_TRANSCRIPT_LENGTH=3`. Match olan transkript boş döndürülür, chat'e gitmez.
2. **Anti-phantom prompt:** Whisper'a `prompt: 'Bu bir koçluk diyaloğudur. Sadece konuşulanı yazıya dök.'` geçilerek altyazı tarzı output bias'ı azaltıldı.

**İlgili dosyalar:** `src/app/api/sessions/[id]/stt/route.ts`

---

### TTS-ECHO-001 — TTS→Mic Echo Loop (ÇÖZÜLDÜ ✅)

**Kök neden:** TTS oynarken hoparlörden çıkan ses mic'e geri kaçıyor (echo). Echo seviyesi VAD eşiğini aşınca VAD bunu "kullanıcı konuşması" sayıyor → kayıt başlatıyor → Whisper boş/echo audio'sundan phantom üretiyor → barge-in tetikleniyor → AI sözünü kesip phantom'a cevap veriyor.

**Uygulanan fix'ler:**
1. **`src/hooks/useNaturalVoice.ts`** — `getUserMedia` constraints'e `echoCancellation: true, noiseSuppression: true, autoGainControl: true` eklendi (donanım/browser AEC).
2. **Adaptive VAD threshold:** Hook'a `isOutputPlaying` prop'u eklendi. TTS oynarken eşik `0.005 → 0.030` yükseliyor; gerçek konuşma 0.05+ üretir, echo (0.005-0.020) filtrelenir.
3. **`VoiceSessionClient.tsx` + `DebriefSessionClient.tsx`** — `useAudioPlayer.isPlaying` → `useNaturalVoice.isOutputPlaying` bağlantısı kuruldu.

**İlgili dosyalar:** `src/hooks/useNaturalVoice.ts`, `src/components/sessions/VoiceSessionClient.tsx`, `src/components/sessions/DebriefSessionClient.tsx`

---

### PROMPT-EARLYEND-001 — Erken `[SESSION_END]` (ÇÖZÜLDÜ ✅)

**Kök neden:** `system-prompt.builder.ts`'teki faz direktifleri zayıf — `closing` fazı tanımı "Özet yap, kapat" demekle yetiniyordu, `[SESSION_END]` için sayısal alt sınır yoktu. AI 5-6 turda kapanışa geçiyor, `[SESSION_END]` basıp seans `debrief_active`'e atlıyordu. Phantom mesaj akışı varsa AI kafası karışınca daha da hızlı kapatıyordu.

**Uygulanan fix:** Faz başına minimum tur sayısı ve `[SESSION_END]` için iki net koşul:
- Toplam ≥13 user-assistant turu **VE** closing fazı yürütülmüş, VEYA
- Kullanıcı açıkça "seansı bitirelim/yeter/teşekkürler" gibi bitiş niyeti ifade etmiş.
- "tamam/evet/olur" gibi kısa onaylar bitiş SAYILMAZ. Phantom transkriptleri umursama. Şüphe halinde **bir tur daha sor**.

**İlgili dosyalar:** `src/lib/session/system-prompt.builder.ts`

---

### END-001 — "Seansı Bitir" Butonu Sessiz Fail (ÇÖZÜLDÜ ✅)

**Kök neden:** `VoiceSessionClient.handleNaturalEnd`, `endSessionAction`'ın `{ success, error }` sonucunu hiç kontrol etmiyordu. Action başarısız döndüğünde (örn. concurrent state mismatch, network) hata sessizce yutuluyor, `router.refresh()` yine çağrılıyor ama session hâlâ `active` olduğu için sayfa DebriefSessionClient'a geçmiyordu. Kullanıcıya ne hata mesajı ne de görsel feedback gösteriliyordu.

**Uygulanan fix:** `handleNaturalEnd` ve benzeri action call'ları artık result'u kontrol ediyor, başarısızlıkta `toast.error()` ile mesaj gösteriyor ve `setIsEnding(false)` ile butonu tekrar etkinleştiriyor.

**İlgili dosyalar:** `src/components/sessions/VoiceSessionClient.tsx`

---

### DEBRIEF-AUTOPLAY-001 — Debrief Sayfasında Sesli Başlangıç Yok (ÇÖZÜLDÜ ✅)

**Kök neden:** `endSessionAction` → `router.refresh()` → page reload → `DebriefSessionClient` mount. Mount sırasında auto-start `audio.play()` çağrısı yapıyordu ama page refresh user-gesture chain'i kopardığı için browser autoplay policy çağrıyı reddediyordu (özellikle Safari). Kullanıcı debrief avatar'ını görüyor ama hiçbir ses duymuyordu, etkileşim de imkânsızdı.

**Uygulanan fix:** Auto-start kaldırıldı. Pre-start ekranı eklendi: kullanıcı **"Geri bildirime başla"** butonuna basınca:
1. `unlockAudio()` senkron olarak (gesture içinde) çağrılır.
2. Mikrofon izni alınır.
3. `setHasStarted(true)` → debrief UI render edilir.
4. Init message + TTS başlar — bu noktada autoplay açılmıştır.

`debriefStartedRef`, `debriefStarting`, `hasStarted` state'leri eklendi. "Atla, doğrudan rapora geç" linki de pre-start'ta sunulur (debrief atlanabilir kalır).

**İlgili dosyalar:** `src/components/sessions/DebriefSessionClient.tsx`

---

### ROLE-INVERSION-001 — AI Koç Olarak Davranıyor (ÇÖZÜLDÜ ✅) — KRİTİK ÜRÜN BUG'I

**Kök neden (en önemli ürün hatası):** Sistem mimarisi yanlış kuruluydu. Persona prompt'u ("Sen Ahmet Yılmaz'sın, çalışansın, yöneticin seni çağırdı") doğruydu AMA `system-prompt.builder.ts`'in eklediği üst-direktifler AI'ı koç moduna sokuyordu:

1. **Rubric section:** *"Bu boyutlara göre değerlendirilecek, **konuşma sırasında bu boyutları aktive edecek sorular sor**"* — AI bunu "ben koç olmalıyım" olarak yorumluyordu.
2. **Phase directives:** *"opening: Kendini tanıt, senaryo bağlamını kur"*, *"exploration: Sorun ve durumu keşfet, açık uçlu sorular sor"*, *"action: aksiyonlar belirle, taahhüt al"* — hepsi koç aktiviteleri.
3. **Greeting trigger** (client'tan gelen): *"Seansı başlat. Kısa ve samimi bir 'Merhaba {ad}' ile seansı aç, **sonra seans senaryosuna geç**"* — AI'a "konuşmayı sen yönet" emri.

Sonuç: AI, kullanıcıya "sahaya çıkmak nasıl bir deneyimdi senin için?" diye soruyordu. Yani kullanıcı çalışan, AI yöneticiymiş gibi davranıyordu. **Ürünün ana amacı tersine dönmüştü.**

**Ürün gerçeği:** Bu sistem yöneticilerin (bölge müdürü, kısım amiri, direktör vs.) **kendi koçluk becerilerini pratik etmesi** için. Kullanıcı = koç (yönetici), AI = personel (Ahmet Yılmaz vb.). Debrief'te kullanıcının koçluk yetkinliği ICF rubric'lerine göre değerlendirilir.

**Uygulanan fix'ler:**

1. **`system-prompt.builder.ts`** — Persona prompt'tan hemen sonra **`roleReminder`** bölümü eklendi (en yüksek öncelikli direktif): *"Sen çalışansın, kullanıcı yöneticindir/koçundur. SEN soru sormazsın, tavsiye vermezsin. Kullanıcı kötü koçluk yapsa bile onu kurtarmaya çalışma — kendi karakterinde kal."*
2. **Rubric section yeniden yazıldı:** *"Bu boyutlar **kullanıcının (koçun)** değerlendirilmesi için. Sen ilgilenme. Kullanıcı bu becerileri uygulamaya çalışacak; sen organik tepki ver."*
3. **Phase directives yeniden yazıldı:** Fazlar artık **kullanıcının** koçluk aşamasını etiketleme amaçlı. AI fazlara göre davranış değiştirmez. Marker tamamen sistem içi (TTS'ye gitmez).
4. **Greeting trigger değiştirildi (`VoiceSessionClient.tsx`):** *"Kullanıcı yöneticin/koçun olarak seni odasına çağırdı. Karakterine uygun, kısa bir selam ver. **Hiçbir koç sorusu sorma**, hiçbir bağlam kurma — sadece selamla ve sus. Konuşmayı yönetici başlatacak."*

**İlgili dosyalar:** `src/lib/session/system-prompt.builder.ts`, `src/components/sessions/VoiceSessionClient.tsx`

---

### MARKER-LEAK-001 — Phase Marker TTS'e Sızıyor (ÇÖZÜLDÜ ✅)

**Kök neden:** AI bazen `[PHASE:opening]` yerine "Phase Opening" gibi bracket'sız doğal dil ifadesi yazıyor. Strip regex'i sadece `/\[PHASE:(opening|...)\]/` (g flag yok, case-sensitive, sadece bracket form) yakalıyordu. Sonuç: kullanıcı TTS'de "Phase Opening" gibi ifadeleri sesli duyuyordu. Production'da kabul edilemez.

**Uygulanan fix'ler:**
1. **Server (`chat/route.ts`)** — `PHASE_MARKER_STRIP_REGEX` (bracket varyantları, gi flags), `NAKED_PHASE_REGEX` (Phase/Faz + faz adı, TR + EN), `SESSION_END_NAKED_REGEX` eklendi. Tek `stripMarkers()` helper'ı hem stream chunk'larında hem fullResponse'da uygulanıyor.
2. **Client (`audio-utils.ts` + `VoiceSessionClient.tsx`)** — Defansif `sanitizeForTTS()` helper. `speakText` artık server'dan gelen text'i tekrar sanitize ediyor (chunk boundary'lerde marker bölünebiliyor).

**İlgili dosyalar:** `src/app/api/sessions/[id]/chat/route.ts`, `src/lib/audio-utils.ts`, `src/components/sessions/VoiceSessionClient.tsx`

---

### STT-PHANTOM-002 — Türkçe "İ" Phantom Filter Bypass (ÇÖZÜLDÜ ✅)

**Kök neden:** STT phantom filter `WHISPER_PHANTOM_PATTERNS` regex'leri `i` flag ile case-insensitive match yapıyordu. Ama JavaScript default `toLowerCase()` Türkçe büyük "İ" karakterini doğru çevirmiyor (combining character `i̇` üretiyor). Sonuç: "İzlediğiniz için teşekkür ederim" gibi büyük "İ" ile başlayan phantom'lar regex'i geçiyordu.

**Tespit:** Test seansı 9d7d486b... — kullanıcı Neslihan Hanım personasıyla 12 mesaj sağlam koçluk yaptı, sonra `#13 user/opening: İzlediğiniz için teşekkür ederim.` (phantom — kullanıcı söylemedi). Filtre yakalamadı, AI cevap verdi, akış bozuldu.

**Uygulanan fix:** `src/app/api/sessions/[id]/stt/route.ts` — `isPhantomTranscript()` artık `text.toLocaleLowerCase('tr-TR')` ile normalize ediyor; sonra regex match. tr-TR locale "İ" → "i" doğru çevirir.

**İlgili dosyalar:** `src/app/api/sessions/[id]/stt/route.ts`

---

### CONTEXT-LOSSY-001 — Summarization Lossy Compression (KALDIRILDI ✅)

**Kök neden ve karar:** Her 5 mesajda QStash ile rubric-aware summarize worker (ADR-013) tetikleniyordu. Chat API kümülatif özet + son 5 mesaj alıyordu. Ama:
- 13-25 mesajlık tipik seanslar için summary lossy compression yapıyor (nuance kaybı)
- gpt-4o 128k context taşıyor — full history maliyeti $0.005-0.01/seans (önemsiz)
- Summary worker kendisi LLM çağrısı yapıyor (~$0.002/çağrı, net tasarruf negatif)
- Race condition (özet hazır olmadan chat çekme) ek risk
- Karmaşıklık (queue + worker + state)

Kullanıcı (Özcan) önerisi üzerine summarization eşiği 5 → 50 mesaja çıkarıldı. Tipik seanslarda summary devre dışı; uzun seanslarda (50+) tekrar devreye girer.

**Uygulanan fix:**
1. `src/lib/session/message.service.ts` — `SUMMARIZATION_THRESHOLD = 50` constant. Trigger artık `count >= 50 && count % 10 === 0` (eskiden `count % 5 === 0`).
2. `src/app/api/sessions/[id]/chat/route.ts` — `getSessionHistoryWithSummary()` → `getSessionHistory(sessionId, 50)` geçişi. Full ham history gönderiliyor.

**İlgili dosyalar:** `src/lib/session/message.service.ts`, `src/app/api/sessions/[id]/chat/route.ts`

> **Not:** ADR-013 revize edilmiş sayılır — summary stratejisi 50+ mesaj için aktif, küçük seanslarda dormant. Summary worker kodu aynen duruyor (kapatılmadı, sadece eşik yükseltildi).

---

### PROMPT-HALF-001 — Yarım Cümle Tamamlama (ÇÖZÜLDÜ ✅)

**Kök neden:** Test seansında kullanıcı "Şirket olarak bizim kültürümüzde aslında..." diyerek yarıda bırakıp düşündü. AI cümleyi kendi başına tamamlayıp konuyu yönlendirdi. Bu, role-inversion'ın hafif kalıntısı — persona çok yardımsever, koç eğilimi gösteriyor.

**Uygulanan fix:** `system-prompt.builder.ts` `roleReminder` bölümüne "Yarım Cümle ve Belirsiz Girdiler" alt başlığı eklendi:
- Yarım kalan cümleyi tamamlama, kendi başına yönlendirme yapma.
- Kısa onay yeterli ("Evet?", "Devam edin", "Sizi dinliyorum"), sonra sus.
- Kısa/anlamsız girdilere ("evet", "hı") minimum yanıt.
- Phantom izlenimi veren ifadeler son anlamlı mesaja dönüş.

**İlgili dosyalar:** `src/lib/session/system-prompt.builder.ts`

---

### STT-PHANTOM-003 — YouTube Outro Phantom'ları (ÇÖZÜLDÜ ✅)

**Kök neden:** Whisper Türkçe YouTube içeriğinden "abone olmayı unutmayın", "videoyu beğenmeyi unutmayın", "yorum yapmayı unutmayın", "kanalımıza abone olun" gibi outro pattern'leri öğrenmiş. Sessizlik veya kısa audio'da bunlar phantom olarak çıkıyor. Mevcut filter altyazı kredilerini yakalıyordu ama YouTube outro'larını yakalamıyordu.

**Tespit:** Murat Kaya seansı (0352ec22...) — 14 mesaj sağlam koçluk akışı, sonra `#16 user: Abone olmayı, yorum yapmayı ve beğen butonuna tıklamayı unutmayın.` ve `#19 user: Abone olmayı ve videoyu beğenmeyi unutmayın.` phantom'ları geçti.

**Uygulanan fix:** `src/app/api/sessions/[id]/stt/route.ts` `WHISPER_PHANTOM_PATTERNS` listesine 6 yeni regex eklendi:
- `\babone\s+ol(may[ıi])?/i`
- `\bbe[ğg]en\s+butonu/i`
- `\bvideoyu\s+be[ğg]en/i`
- `\byorum\s+yap(may[ıi])?\s+unutmay[ıi]n/i`
- `\bkanal[ıi]m[ıi]z[aıe]?\s*abone/i`
- `\bbir\s+sonraki\s+videoda/i`

False positive riskini düşürmek için pattern'ler kombinasyon gerektiriyor (örn. "yorum yap" yerine "yorum yapmayı unutmayın").

**İlgili dosyalar:** `src/app/api/sessions/[id]/stt/route.ts`

---

### END-002 — `endSessionAction` ENUM Hatası → "Seans Tamamlanamadı" (ÇÖZÜLDÜ ✅)

**Kök neden:** `endSessionAction` UPDATE'inde `cancellation_reason: reason` yazıyordu (`reason = 'user_ended'` veya `'ai_ended'`). Ama `cancellation_reason` ENUM'unda bu değerler yoktu — sadece `'manual_cancel', 'drop_off', 'technical_failure', 'technical_issue', 'persona_wrong_fit', 'scenario_too_hard', 'user_interrupted'` vardı (migration 007 + 038). DB UPDATE invalid enum value hatası → "Seans tamamlanamadı" toast.

**Karar:** Semantik olarak `endSessionAction` "kapatma" değil "debrief'e geçiş" — `cancellation_reason` yazmamak daha doğru. Migration 047 ile enum genişletildi (yedek), ama esas fix kod tarafında: `cancellation_reason: reason` satırı UPDATE'ten kaldırıldı. `reason` parametresi imzada kaldı (telemetri için ileride `end_reason` kolonu eklenebilir).

**Uygulanan fix'ler:**
1. `src/lib/actions/session.actions.ts` — `endSessionAction` UPDATE'inden `cancellation_reason` satırı çıkarıldı; DB error logging eklendi
2. `supabase/migrations/20260427_047_cancellation_reason_natural_end.sql` — enum'a `user_ended` + `ai_ended` eklendi (savunma katmanı, manuel SQL Editor'da çalıştırılır — `ALTER TYPE` transaction'da çalışmaz)

**İlgili dosyalar:** `src/lib/actions/session.actions.ts`, `supabase/migrations/20260427_047_*.sql`

---

### CANCEL-404-001 — Yarıda Kesilen Seans → /report 404 (ÇÖZÜLDÜ ✅)

**Kök neden:** `cancelSessionAction` status'u `cancelled` yapıyordu. Page route `[id]/page.tsx` `['completed', 'cancelled', 'failed', 'debrief_completed']` durumlarını `/report` sayfasına yönlendiriyordu. Ama `cancelled` seansların evaluation'ı yok, `/report` sayfası 404 döndürüyordu.

**Uygulanan fix:** `src/app/(dashboard)/dashboard/sessions/[id]/page.tsx` — `cancelled` ayrı handle ediliyor: `/dashboard/sessions?cancelled=<id>` query string ile listeye redirect. Listenin opsiyonel olarak "Seans yarıda kesildi" toast/notice gösterebilmesi için query param eklendi (gelecekte UI tarafına bağlanabilir).

**İlgili dosyalar:** `src/app/(dashboard)/dashboard/sessions/[id]/page.tsx`

---

### UI-BADGE-002 — Badge `variant="outline"` Tüm Site'de Kırık (ÇÖZÜLDÜ ✅)

**Kök neden:** `src/components/ui/badge.tsx`'in outline variant tanımı bozuktu:
```ts
variant === 'outline' ? 'border input bg-background text-primary-foreground' : '',
```
İki bug:
1. **`border input`** — `input` Tailwind'de tanımlı değil. Doğrusu `border-input` (CSS var `--input`). Tailwind bu typo'yu sessizce yutuyor → border rengi default'a düşüyor.
2. **`text-primary-foreground`** — primary-foreground light theme'de **beyaz** (mavi primary üstüne kontrast için). Outline'ın `bg-background` da beyaz. Yazı arka planla aynı renk → **görünmez**.

Bu çekirdek bir component hatası — site genelinde tüm `variant="outline"` Badge'leri etkiliyordu (Senaryo zorluk badge'i, eski Status badge'leri, vb.).

**Uygulanan fix:** `variant === 'outline' ? 'border-input bg-background text-foreground' : ''` — typo düzeltildi, text rengi `foreground`'a çevrildi (light=siyah, dark=beyaz, semantic adaptive).

Bonus: `SessionList.tsx`'te difficulty badge için explicit `border-slate-300 bg-slate-50 text-slate-700 dark:...` class eklendi — Senaryo sütunundaki "Orta" gibi etiketler net görünür. `DIFFICULTY_LABELS[0]` boş string'di, `'Belirsiz'` yapıldı; fallback artık `||` ile (boş string'i de kapsar).

**İlgili dosyalar:** `src/components/ui/badge.tsx`, `src/components/sessions/SessionList.tsx`

---

### UI-BADGE-001 — Status Badge Yazı / Arka Plan Kontrast Yetersiz (ÇÖZÜLDÜ ✅)

**Kök neden:** `SessionStatusBadge` sadece dark theme renkleri tanımlıyordu (`text-amber-400`, `bg-amber-500/10`). Light theme'de yazı arka plan rengiyle aynı tonalitede oluyor → okunmuyor. Ayrıca `evaluation_failed`, `debrief_active`, `debrief_completed` status'ları type'ta yoktu, fallback `'failed'` olarak gösteriliyordu.

**Uygulanan fix:**
1. Tüm 9 status için light + dark adaptive class'lar (örn `border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300`)
2. `SessionStatus` type genişletildi: 9 değer (eskiden 6)
3. `SessionList` interface'i de senkronize edildi
4. `evaluation_failed`, `debrief_active`, `debrief_completed` artık doğru label + renkle gösteriliyor

**İlgili dosyalar:** `src/components/sessions/SessionStatusBadge.tsx`, `src/components/sessions/SessionList.tsx`

---

### TTS-409-001 — AI Final Yanıt + Status Geçişi Race (ÇÖZÜLDÜ ✅)

**Kök neden:** AI `[SESSION_END]` gönderdiğinde chat route içinden `endSessionAction(ai_ended)` çağırılıyor → DB status anında `debrief_active` oluyor. Ama AI'ın aynı yanıtının TTS'i client'tan henüz istenmemiş — istek gönderildiğinde server `status !== 'active'` kontrolüne takılıp 409 döndürüyordu. Console'da `TTS [409]: Seans aktif değil` hatası, AI'ın son veda cümlesi sesli oynamıyor.

**Tespit:** Selin Çelik seansı — AI cümleyi kestikten sonra "Evet, belki yapabilirim" yanıtı (içinde [SESSION_END] olabilir) → TTS isteği 409 → console error.

**Uygulanan fix (iki katman):**
1. **Server** (`src/app/api/sessions/[id]/tts/route.ts`) — `'active'` veya `'debrief_active'` kabul ediliyor. AI'ın final TTS'i status değişse bile çalar. Diğer durumlar 409 (artık diagnostik mesaj `current=...` ile).
2. **Client** (`src/components/sessions/VoiceSessionClient.tsx`) — `speakText` 409'u sessizce yutuyor (`console.log` ile, `throw` yok). Defansif: server fix'in kapsamadığı edge case'lerde de UI bozulmaz.

**İlgili dosyalar:** `src/app/api/sessions/[id]/tts/route.ts`, `src/components/sessions/VoiceSessionClient.tsx`

---

### DEBRIEF-OPENING-001 — Debrief Açılışı Çok Soğuk (ÇÖZÜLDÜ ✅)

**Kök neden:** `DEBRIEF_INIT_PREFIX` trigger mesajı sadece *"Debrief seansını başlat. İlk soruyu sor."* diyordu. AI da soğuk başlıyor ("Selam, seans nasıl geçti?"). Kullanıcı için ani — değerlendirme analizinin paralel hazırlandığı bilgisi de yok.

Önerilen UX (kullanıcı geri bildirimi):
*"Merhaba Özcan, nasılsınız? Seans değerlendirme analizi hazırlanırken birkaç soru sormak istiyorum, böylece deneyiminizi daha iyi anlayabilirim. Seans nasıl geçti?"*

**Uygulanan fix:**
1. `src/lib/session/debrief-prompt.builder.ts` — Soru akışına yeni "**0. AÇILIŞ**" bölümü eklendi: sıcak karşılama + değerlendirme bağlamı + ilk soru, tek mesajda.
2. `src/components/sessions/DebriefSessionClient.tsx` — `initMessage` trigger'ı netleşti: "Sistem promptundaki AÇILIŞ kuralına göre önce kullanıcıyı sıcak karşıla, değerlendirme hazırlanmakta olduğunu belirt, sonra ilk soruyu sor."

**İlgili dosyalar:** `src/lib/session/debrief-prompt.builder.ts`, `src/components/sessions/DebriefSessionClient.tsx`

---

### EARLYEND-GUARD-001 — Server-Side SESSION_END Guardrail (ÇÖZÜLDÜ ✅)

**Kök neden:** PROMPT-EARLYEND-001 ile prompt'a "13 turlık seans" kuralı eklendik, ama LLM bunu her zaman dinlemiyor. Selin Çelik test seansında AI cümlesi yarım kesildikten sonra kullanıcı "Son söylediklerini tekrarlar mısın" dedi → AI "Evet, belki yapabilirim" yanıtı + (muhtemelen) `[SESSION_END]` → seans 6-7 turda bitti.

**Uygulanan fix (server-side hard floor):** `src/app/api/sessions/[id]/chat/route.ts` — AI `[SESSION_END]` gönderse bile, session_messages tablosundaki user+assistant mesaj sayısı `SESSION_END_MIN_MESSAGES = 16`'dan azsa marker yok sayılır. Konsol log: `[Chat] AI [SESSION_END] guardrail tetiklendi: msgCount=X < 16, marker yok sayıldı`.

Bu prompt fix'inin kalıbıyla aynı seviyede koruma sağlar — LLM araştığında bile (cutoff sonrası kafa karışıklığı, uzunluk hesabı yanlış, vb.) seans erken bitmez.

> **Not:** 16 mesaj eşiği = 8 user-assistant alışverişi. Prompt'taki 13 turdan daha cömert (defansif). Real cevaplar bu eşiği geçtiyse zaten doğal kapanış olabilir.

**İlgili dosyalar:** `src/app/api/sessions/[id]/chat/route.ts`

---

### DEBRIEF-LATENCY-001 — Debrief Açılış Gecikmesi (KISMEN İYİLEŞTİRİLDİ ⚡)

**Kök neden:** "Geri bildirime başla" butonuna basıldıktan sonra 5-10sn ses gelmiyordu. Akış sıralı: `getUserMedia` (~500-700ms) → `sendToDebrief` (chat API ~2-3sn) → `speakDebrief` (TTS sentez ~1-2sn). Toplam ~3.5-5.5sn ses başlamadan önce.

**Uygulanan fix (paralelleştirme):** `src/components/sessions/DebriefSessionClient.tsx` — `getUserMedia` ve `sendToDebrief` artık `Promise.all` ile paralel başlıyor (bağımsız operasyonlar). Tasarruf ~500-700ms.

```ts
const micPromise = navigator.mediaDevices.getUserMedia(...)
const chatPromise = sendToDebrief(initMessage)
const [micOk, text] = await Promise.all([micPromise, chatPromise])
```

**Geriye kalan latency** ~3-4sn (chat + TTS sentezi). Tam çözüm için pre-canned greeting + background chat (P2 belgesinde plan) gerekir.

**İlgili dosyalar:** `src/components/sessions/DebriefSessionClient.tsx`

---

### UX-SIDEBAR-GAP-001 — Senaryo Seçim Sayfası Light Gap (ÇÖZÜLDÜ ✅)

**Kök neden:** `/dashboard/sessions/new?persona=...` sayfasında, sidebar (dark) ile `CinematicPersonaStage` (dark gradient) arasında SidebarInset'in `bg-background` (light) renkte ince bir şerit görünüyordu — özellikle stepper'ın bulunduğu üst bantta light bg dikkat çekiyor, sidebar bağımsız duruyor gibi.

**Uygulanan fix:** `src/app/(dashboard)/dashboard/sessions/new/page.tsx` — sayfa wrapper'ına stage'in `linear-gradient(155deg, #1a1a2e 0%, #0f0e22 55%, #1c003a 100%)` arka planı uygulandı. Stepper de aynı dark zemin üstünde, transition seamless.

**İlgili dosyalar:** `src/app/(dashboard)/dashboard/sessions/new/page.tsx`

---

### UX-VOICE-LAYOUT-001 — Voice Session Screen Redesign (ÇÖZÜLDÜ ✅) — P2-UX-002

**Kök neden:** Sesli seans ekranı çok minimal — ortada büyük mikrofon, üstte phase indicator, başka hiçbir şey yok. Kullanıcı persona'yı görmüyor, hangi senaryoda olduğunu hatırlamıyor, koçluk ipuçlarını yeniden okuyamıyor, AI ile konuştuğunu yazılı olarak takip edemiyor. Plus VoiceSessionClient bg'si bg-card/30 (light tint) sidebar (dark) ile kontrast oluşturup "gap" hissi yaratıyordu.

**Uygulanan fix (CinematicPersonaStage stilinde — UX-SIDEBAR-GAP-001'i de çözdü):**

VoiceSessionClient artık `/dashboard/sessions/new?persona=...` sayfasındaki CinematicPersonaStage layout'unu birebir devam ettiriyor — kullanıcı senaryo seçtikten sonra aynı sahnede kalıyor, sadece sağ kolon scenario list yerine transkripte dönüşüyor.

- **Outer wrapper:** `linear-gradient(155deg, #1a1a2e 0%, #0f0e22 55%, #1c003a 100%)` — sidebar'a kadar uzanan dark gradient. Light gap kayboldu.
- **Top bar:** Frosted dark `rgba(15,14,34,0.55)` + backdrop-blur, persona thumb + name + title + scenario, sağda PhaseIndicator + Yarıda Kes + Seansı Bitir.
- **Sol kolon (`flex: 0 0 42%`):** Purple radial glow + büyük avatar (180px, grayscale, purple shadow), name (font-headline italic 1.875rem), title (purple tracking), emotional badge (purple pill), VoiceWaveform + VoiceMicButton + status text. Bottom: koçluk notu frosted card (CinematicPersonaStage'in coaching tip pattern'ı birebir).
- **Sağ kolon (`flex: 1`, light surface):** "Konuşma Transkripti" başlığı + auto-scroll chat bubble'lar (kullanıcı = purple gradient, persona = soft purple tint), streaming için 3-nokta indicator, processing için "işleniyor" italic preview.

**Veri akışı genişletildi:** `getActiveSessionData` query'sine `avatar_image_url`, `coaching_tips`, `coaching_context`, `emotional_baseline`, `context_setup` eklendi. `EMOTIONAL_LABELS` map ile baseline Türkçe label.

**İlgili dosyalar:** `src/components/sessions/VoiceSessionClient.tsx`, `src/lib/queries/session.queries.ts`, `src/app/(dashboard)/dashboard/sessions/[id]/page.tsx`

> **Not:** UX-SIDEBAR-GAP-001'in `/sessions/new` sayfasındaki dark gradient fix'i hâlâ geçerli — sahne süreklılığı için orada da gerekli.

---

### UX-SIDEBAR-CORE-001 — Sidebar Gap (KRİTİK GLOBAL BUG, NİHAİ ÇÖZÜM ✅)

**Kök neden:** Flex layout belirsizliği. Sidebar component'inin outer peer-div'i `display: block` ile flex item'dı; explicit width yoktu. Auto-width hesabı ortamlara göre tutarsız davranıyordu:
- Bazen content-derived width (sidebar-width) → SidebarInset'in `ml` ile birleşince **çift sayım** = gap
- Bazen 0 collapse → `ml` kaldırılınca content sidebar **altına** geçiyordu (overlap)

`ml` → `pl` denemesi de aynı belirsizlik altında iki ucu çözmüyordu (peer-div bazen flow space alıyor, `pl` ekleyince çift olup gap dönüyordu).

**Nihai çözüm (üçüncü iterasyon):** Belirsizliği ortadan kaldırmak için **peer-div'e explicit width** vermek + SidebarInset'ten margin/padding offset'i tamamen kaldırmak.

```diff
Sidebar component (peer-div):
- className="group peer hidden text-sidebar-foreground md:block"
+ className={cn(
+   "group peer hidden text-sidebar-foreground md:block md:flex-shrink-0",
+   "md:w-[var(--sidebar-width)]",
+   "group-data-[collapsible=offcanvas]:md:w-0",
+   variant === "floating" || variant === "inset"
+     ? "group-data-[collapsible=icon]:md:w-[calc(...)]"
+     : "group-data-[collapsible=icon]:md:w-[--sidebar-width-icon]"
+ )}

SidebarInset:
- "md:peer-data-[state=expanded]:ml-[var(--sidebar-width)] ...",  // kaldırıldı
- "md:peer-data-[state=expanded]:pl-[var(--sidebar-width)] ...",  // (denedik) kaldırıldı
+ // hiçbir state-bazlı offset yok — peer-div kendi width'i ile flex space alıyor
"md:peer-data-[variant=inset]:m-2 ...",  // inset için korundu
```

Artık:
- Peer-div flex item: explicit `w-[--sidebar-width]` (state'e göre değişir, transition var)
- Fixed sidebar visual: peer-div'in içinde, sol üst köşede 0'dan başlar, w-[--sidebar-width]
- SidebarInset: peer-div'in sağında flex-1 ile başlar — natural offset = sidebar-width
- Gap yok (ml margin alanı yok), overlap yok (peer-div garanti olarak space alıyor)

**Etki: Site genelinde** tüm dashboard sayfalarında. Sayfa-level dark gradient hack'leri estetik için tutuluyor (gap-fix amacı yok artık).

**Defense in depth (4. katman):** SidebarProvider wrapper'ına `bg-sidebar` eklendi. Bilinmeyen kaynaklı sızıntı (peer-div'in transparent alanı, AppHeader'ın `bg-surface/80` semi-transparency, SidebarInset bg-background fazlalığı) artık light değil dark gözükür.

**Asıl çözüm — Yapısal Sadeleştirme (5. katman, kullanıcı önerisi):**
Eski Sidebar'ın 3 katlı iç içe yapısı `outer peer-div + inner spacer + inner fixed div + bg-sidebar wrapper` flex layout'a tutarsızlık katıyordu. Tek bir `<aside>` element'ine indirgendi:

```diff
- <div className="group peer hidden md:block ...">
-   <div className="relative w-[--sidebar-width] bg-transparent ..." />  {/* spacer */}
-   <div className="fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] md:flex ..." {...props}>
-     <div data-sidebar="sidebar" className="flex h-full w-full flex-col bg-sidebar ...">
-       {children}
-     </div>
-   </div>
- </div>

+ <aside
+   data-sidebar="sidebar"
+   className={cn(
+     "group peer hidden md:flex md:flex-col md:flex-shrink-0",
+     "bg-sidebar text-sidebar-foreground",
+     "md:sticky md:top-0 md:h-svh md:z-10",
+     "md:transition-[width] md:duration-200 md:ease-linear",
+     "md:w-[var(--sidebar-width)]",
+     ...
+   )}
+ >
+   {children}
+ </aside>
```

- `position: fixed` → `position: sticky top-0 h-svh` — scroll'da üstte sabit
- Spacer kaldırıldı — explicit `w-[--sidebar-width]` ile flex flow space
- Wrapper div kaldırıldı — bg-sidebar doğrudan aside üzerinde
- Tek katman → flex layout deterministik, leak imkansız

**Sidebar genişlik nihai:** `16rem → 18 → 20 → 22 → 17rem`. Yapısal sadeleştirme sonrası gap eliminasyonu için "absorb için geniş tutma" zorunluluğu kalmadı; menü etiketleri rahatça sığacak makul **17rem**'de dengelendi.

**İlgili dosyalar:** `src/components/ui/sidebar.tsx`

---

### UX-SIDEBAR-WIDTH-001 — Sidebar Genişlik İterasyonları ✅ (NİHAİ: 17rem)

Kullanıcı geri bildirimleriyle 5 kez ayarlandı:
1. `16rem` (orijinal — kullanıcı "biraz dar" buldu)
2. `18rem` (ilk artırma)
3. `20rem` (gap absorbsiyonu için)
4. `22rem` (gap hâlâ görünüyordu)
5. **`17rem`** (yapısal sadeleştirme sonrası — gap eliminé olduğu için geniş tutma gereği kalmadı)

Mobile drawer: `20rem`. Icon collapse: `3rem`.

**İlgili dosyalar:** `src/components/ui/sidebar.tsx`

---

### UX-PERSONA-LAYOUT-001 — Persona Info Sütunu Yeniden Tasarımı (ÇÖZÜLDÜ ✅)

**Kullanıcı isteği:** Persona/sahne ekranlarında foto üstte ortalı, altında persona meta-verileri kartlar halinde — Tenant Admin persona detay görünümü zenginliğinde.

**Uygulanan fix:** Yeni paylaşılan component `src/components/sessions/PersonaInfoColumn.tsx` oluşturuldu:
- 180px grayscale avatar + purple shadow halo
- Name (italic font-headline 1.875rem) + Title · Department (purple uppercase)
- Emotional baseline pill (purple)
- 2'li grid: Deneyim (yıl) + Persona Tipi (Düşen Performans / Yükselen Performans / vb.)
- 3'lü grid: Zorluk / Direnç / İşbirliği (X/5 score badges)
- Senaryo Bağlamı (scenario.context_setup)
- Koçluk Bağlamı (persona.coaching_context)
- Tetikleyici Davranış tag'leri (`"süreçleri eleştirir"` vb.)
- Koçluk İpuçları (highlight kart, listelenmiş)

Tüm bölümler opsiyonel, NULL durumlarda gizlenir. Purple radial glow background korundu.

**Kullanılan yerler:**
- `CinematicPersonaStage` (sol panel — eski hero panel kaldırıldı)
- `VoiceSessionClient` (sol panel — eski sade avatar+name kaldırıldı; mic alt sticky)

**Veri akışı genişletildi:** Hem `getPersonaDetail` (persona.queries.ts zaten zengindi) hem de `getActiveSessionData` (session.queries.ts) personayı tüm meta-verisi ile çekiyor: `department, experience_years, growth_type, difficulty, resistance_level, cooperativeness, trigger_behaviors`.

**İlgili dosyalar:** `src/components/sessions/PersonaInfoColumn.tsx` (yeni), `src/components/sessions/CinematicPersonaStage.tsx`, `src/components/sessions/VoiceSessionClient.tsx`, `src/lib/queries/session.queries.ts`, `src/app/(dashboard)/dashboard/sessions/[id]/page.tsx`

---

### END-RACE-001 — "Seansı Bitir" + AI Auto-End Race (ÇÖZÜLDÜ ✅)

**Kök neden:** AI `[SESSION_END]` gönderdi → chat route `endSessionAction(ai_ended)` çağırdı → status `debrief_active` oldu. Bu sırada kullanıcı "Seansı Bitir" butonuna bastı → `endSessionAction` "Aktif seans değil" hatası döndü → toast.error gösterildi. Aslında seans zaten bitmişti, kullanıcıya yanlış izlenim verildi.

**Uygulanan fix:** `handleNaturalEnd` artık `'Aktif seans değil'` hatasını özel olarak ele alıyor: toast yerine `router.refresh()` çağırıyor. Page route status=`debrief_active` okur, DebriefSessionClient'a yönlendirir.

**İlgili dosyalar:** `src/components/sessions/VoiceSessionClient.tsx`

---

### ENV-001 — OPENAI_LLM_MODEL Hatalı Değer (ÇÖZÜLDÜ — kullanıcı düzeltti ✅)

**Kök neden:** `.env.local`'de `OPENAI_LLM_MODEL=gpt-5.4` tanımlıydı (bu model mevcut değil). OpenAI 404 döndürüyordu → chat route exception → session `status='failed'`. STT 409 "Seans aktif değil" hatasının altta yatan nedeni buydu.

**Fix:** Kullanıcı değeri `gpt-4o` olarak düzeltti. Tüm chat/summarize/evaluation/debrief route'ları bu değeri kullanır.

> **Not:** `CLAUDE.md` → "Phase 2 Product Decisions → Model (C1+C3)" bölümündeki `gpt-5.4` referansı artık geçersizdir. Doğru değer `gpt-4o` (veya kullanıcının tercih ettiği geçerli model).

---

## Current Status (2026-04-26 — Phase 3 büyük ölçüde tamam, 1 Mayıs canlı yayın hedefi)

> **AKTİF SPRINT:** [`canli_yayina_cikis_plani_20260425.md`](Gelistirme23Nisan/canli_yayina_cikis_plani_20260425.md) — 1 Mayıs 2026'ya 6 günlük launch planı. **Her oturumda ilk önce bu belgeye bak.** Karar defteri (K-001..K-004), 6 günlük checklist ve risk planı içerir. Settled konuları yeniden açma.

Detailed analysis documents for the ongoing development effort live in `Gelistirme23Nisan/`:

- **`canli_yayina_cikis_plani_20260425.md`** — **AKTİF** — 1 Mayıs sprint planı + karar defteri
- **`Pre_Launch_Phase_1.md`** — **YENİ (2026-04-26)** — Persona roleplay sözleşmesi parametrikleştirme (~4.5 saat, low-risk, opsiyonel pre-launch)
- **`Post_Launch_Phase_2.md`** — **YENİ (2026-04-26)** — Tam parametrik roleplay mimarisi (mode preset'ler + dinamik faz + evaluation target, ~2 hafta, post-launch)
- **`Post_Launch_Iyilestirmeler.md`** — **YENİ (2026-04-27)** — Post-launch iyileştirme listesi (P1/P2/P3/R&D), STT upgrade önerisi + diğer 13 iyileştirme
- **`system_analiz_20260423.md`** — Fact-grounded codebase map, 9 critical findings
- **`mimari_kararlar_20260423.md`** — **15 ADRs** (ADR-001..ADR-016; ADR-006 ve ADR-009 Proposed, diğerleri Accepted; **ADR-016 Persona Roleplay Sözleşmesi Parametrikleştirme** eklendi 2026-04-26)
- **`akis_haritasi_20260423.md`** — 13 workflow specs: §1-§6 uygulama kabuğu + §7-§13 AI Roleplay Core Flow (voice session, interrupt, debrief, report audio, summarization, dev plan, feedback review)
- **`yol_haritasi_20260424.md`** — Phased roadmap (Phase 0–3). Phase 0+1+2+3 tamam. **Sesli Seans Stabilizasyon Sprint'i (2026-04-26) eklendi.**
- **`rubric_icf_20260424.md`** — ICF 8 koçluk boyutu için 1-5 puan kriterleri, evidence şeması, custom rubric önerileri.

### Veritabanı Stratejisi (1 Mayıs Öncesi — KESİN)

- **Geliştirme + test:** Sadece **Staging DB** (`Aion_Mirror_Staging`). `.env.local` ve `.env.staging` her ikisi de buna bakar.
- **Production DB:** Şu an boş kabuk, gerçek veri yok. **1 Mayıs deploy zamanına kadar dokunulmayacak.** Deploy zamanı sıfırlanıp tüm migration'lar (001 → 041) sırayla çalıştırılır.
- **Lokal Supabase YOK.** `npm run dev` doğrudan Staging DB'ye bağlanır.

### Confirmed Product Decisions

- **Sign-up:** Invite-only for MVP (no self-serve)
- **Auth method (ADR-010 Accepted):** Passwordless OTP via email. No passwords stored. Users invited via `supabase.auth.admin.inviteUserByEmail()` — receive a magic link, then authenticate with OTP codes. First-login password change flow removed.
- **Bulk user provisioning (MVP — IMPLEMENTED):** CSV/XLSX upload. Columns: `Ad Soyad`, `E-posta`, `Rol`, `Departman`. Excel template with Rol dropdown served from `GET /api/templates/users`. Per-row result table shown after upload. Uses `inviteUserByEmail` — no passwords.
- **Role change side effect:** Force sign-out — `src/lib/auth/role-sync.ts` + `updateUserRoleAction` → JWT sync + `/auth/v1/admin/users/{id}/logout` REST çağrısı. **Implementasyon tamamlandı.**
- **Evaluation persistent failure UI:** After 3 QStash retries, show "Değerlendirme başarısız oldu, yeniden deneyin" + retry button (state: `evaluation_failed`)
- **Supabase env strategy:** Two separate projects (staging + prod) + local `supabase start`. Pro + branching deferred to post-revenue.
- **Email provider:** Resend SMTP, verified sender domain `mirror.aionmore.com`, sender `noreply@mirror.aionmore.com`. Configured in Supabase Authentication → SMTP Settings.

### Phase 2 Product Decisions (2026-04-24 — Voice-Only Roleplay Core Flow)

- **Voice-only mode (ADR-011):** Text modu tamamen kaldırıldı. Tüm seanslar sesli. `SessionClient.tsx` silindi, sadece `VoiceSessionClient` kalıyor. **IMPLEMENTED (P2-100 ✅)**
- **Seans başlatma (A1+A2):** Sayfa açılınca otomatik başlamaz. Kullanıcı mikrofon butonuna basar → persona "Merhaba {ad}" ile açılış yapar → VAD dinlemeye geçer → barge-in destekli.
- **Seansı Yarıda Kes (B):** Ayrı buton. AI analizi YOK. Reason modal 4 seçenek: technical_issue / persona_wrong_fit / scenario_too_hard / user_interrupted. Dashboard'da persona bazlı yarıda kesme istatistiği.
- **Transcript özetleme (ADR-013):** Her 5 mesajda QStash ile rubric-aware summarize worker. Chat API artık 40 mesaj değil, kümülatif özet + son 5 mesaj gönderiyor. Aynı LLM modeli kullanılır (kalite öncelik).
- **Ses kaydı saklanmaz:** Seans konuşması sadece transcript olarak DB'de şifreli. Audio RAM'de, Whisper'a gidip atılır. İSTİSNA: Sesli rapor özeti Supabase Storage'da kalıcı (tekrar dinleme için).
- **Debrief (ADR-012):** Seans biter bitmez farklı voice ID (tok ses, koç karakteri) devreye girer. AI-driven samimi sohbet (4-5 soru, 1-2 dk). Paralel olarak evaluation çalışır. Bittiğinde hazırsa rapor, değilse "Hazırlıyorum" mesajı.
- **Debrief transcript (D3):** Evaluation'a girmez. Super admin "/admin/feedback" sayfasında persona/senaryo prompt iyileştirme için okur. PII maskeleme zorunlu.
- **Sesli rapor (E1+E2):** Tüm rapor metni okunur (genel puan hariç). Ortalama karşılaştırma dahil. Sadece dinleme modu (play/pause). Supabase Storage'da MP3 kalıcı, tekrar dinlenebilir.
- **STT/TTS (F1+F2):** OpenAI Whisper + ElevenLabs Turbo v2.5 (OpenAI Realtime'a şimdilik geçilmiyor).
- **Persona voice ID (ADR-014):** Her persona için farklı ElevenLabs voice ID. Debrief koçu ayrı voice ID (`ELEVENLABS_DEBRIEF_COACH_VOICE_ID`).
- **Development plan (ADR-015):** Her evaluation sonrası async aggregate worker → son 5 seansın sentezi. Dashboard + profilim + tenant/users/[id] widget'larında: güçlü yanlar, gelişim alanları, eğitim + kitap önerileri. 30 gün TTL.
- **ICF rubric (G4):** 8 standart boyut `is_locked=true` (değiştirilemez); tenant admin pasif yapabilir. 4 ek custom rubric (executive/team/performance/wellbeing) tenant bazlı aktive edilebilir/değiştirilebilir.
- **Test verisi (G1+G2+G3):** 5 persona (Ahmet Yılmaz + Murat Kaya + Neslihan Bozkurt + Selin Çelik + 1 yeni) × 2-3 senaryo. User mevcut DB'deki 4 personayı SELECT sorgusuyla çekecek, yeni persona + seed migration sonrası DB'ye eklenecek.
- **Model (C1+C3):** `OPENAI_LLM_MODEL` env'i — `gpt-5.4` HATALI (model mevcut değil, session 'failed' yaptıyordu). Doğru değer `gpt-4o` veya kullanıcının tercihi. Chat + summarize + evaluation + debrief hepsi aynı model (kalite öncelik).
- **Dashboard kişi bazlı görünüm (B1 + soru 4):** `/tenant/users/{id}` detay sayfası — tenant_admin/hr_admin/hr_viewer/manager kullanıcı dashboard'larını görebilir.

### Phase 1 — Completed Items (2026-04-24)

- ✅ **P1-001** — next.config.ts env-driven Supabase host (fallback only)
- ✅ **P1-002** — Stale `/sessions/new` route kaldırıldı; boş `src/modules/*/` klasörlerine README eklendi
- ✅ **P1-003** — Feature flags: `progressPage`, `notificationsPage`, `managerPages` eklendi; placeholder sayfalar `notFound()` arkasına alındı; nav flag-aware
- ✅ **P1-OTP-A** — Resend SMTP konfigürasyonu (user tarafından yapıldı)
- ✅ **P1-OTP-B** — 2-adımlı OTP login UI + Upstash Redis rate limiting
- ✅ **P1-005/006** — Bulk upload Phase A+B (parse + commit + inviteUserByEmail)
- ✅ **P1-008** — Inactivity auto-logout (useIdleTimeout + IdleTimeoutManager + BroadcastChannel)

### Phase 1 — Remaining

- ⏳ **P1-007** — Staging Supabase projesi kurulumu (manuel, kullanıcı yapacak)

### Phase 0 + 1 — Tüm Kod Tamamlandı

Tüm Phase 0 ve Phase 1 **kod değişiklikleri** tamamlandı. Bekleyen DB işlemleri:

> **⚠️ Kritik (önce bu):** `20260426_046_session_messages_align.sql` — AI konuşma geçmişi için şart. Supabase SQL Editor'da çalıştır.
> Diğer bekleyen migration'lar: `039_notifications.sql` ve `040_evaluation_failed_status.sql` — Supabase SQL Editor'da çalıştır.

### Tamamlanan — Phase 0

- ✅ **P0-001** — QStash env zaten aligned (`UPSTASH_QSTASH_TOKEN` vb.)
- ✅ **P0-002** — badges migration yazıldı + düzeltildi (`DO $$` idempotent), **DB çalıştırması bekleniyor**
- ✅ **P0-003** — GamificationLists optimistic state (toggle + delete sayfa yenilemesiz)
- ✅ **P0-004** — Tüm roller profil güncelleme RLS fix → `migration 028`
- ✅ **P0-005** — `src/lib/auth/role-sync.ts` + `updateUserRoleAction` → JWT sync + force sign-out
- ✅ **P0-006** — `/api/health` super_admin guard + env probe
- ✅ **P0-007 (ADR-010)** — Passwordless OTP + inviteUserByEmail + auth callback token_hash

### Tamamlanan — Phase 0 Ek

- ✅ Rubric dimension kaydetme hatası (`null → undefined` Zod)
- ✅ "Profesyonel Profil" navigasyon (asChild + Link)
- ✅ Bulk upload — `BulkUploadSheet`, `bulk-upload.actions.ts`, Excel template API
- ✅ Turkish role mapping — `.toLocaleLowerCase('tr-TR')`
- ✅ Resend SMTP konfigürasyonu (`noreply@mirror.aionmore.com`)
- ✅ Kullanıcılar sayfası rol bazlı yetki (`tenant_admin` CRUD / `hr_admin`+`manager` read-only)

### Tamamlanan — Phase 1

- ✅ **P1-001** — next.config.ts env-driven Supabase host
- ✅ **P1-002** — Stale `/sessions/new` route kaldırıldı; boş `src/modules/*/` README eklendi
- ✅ **P1-003** — `progressPage`, `notificationsPage`, `managerPages` feature flags; placeholder sayfalar `notFound()` arkasında; nav flag-aware
- ✅ **P1-OTP-A** — Resend SMTP konfigürasyonu
- ✅ **P1-OTP-B** — 2-adımlı OTP login + Upstash Redis rate limiting
- ✅ **P1-005/006** — Bulk upload parse + commit (inviteUserByEmail, sequential, per-row result)
- ✅ **P1-008** — Inactivity auto-logout (`useIdleTimeout` + `IdleTimeoutManager` + `BroadcastChannel`)

### Phase 2 — AI Roleplay Core Flow (tamamlanan + açık)

Spec session 2026-04-24 tamamlandı. Implementation paketleri `yol_haritasi_20260424.md` P2-100..P2-112:

- ✅ **P2-109** — ICF + custom rubric seed migration (migration 031, DB'de çalıştırıldı)
- ✅ **P2-110** — `personas.voice_id` kolonu (migration 032, DB'de çalıştırıldı); persona name unification (migration 030)
- ✅ **P2-100** — Text modu kaldırıldı: `SessionClient.tsx` silindi, `createSessionAction` her zaman `voice`, `CinematicPersonaStage` seans modu seçici kaldırıldı
- ✅ **P2-101** — Mikrofon butonu ile seans başlatma + persona "Merhaba {ad}" selamlama: `greetingStartedRef` guard, `GREETING_TRIGGER_PREFIX` ile LLM init mesajı, `userName` prop `session/[id]/page.tsx`'den geliyor
- ✅ **P2-102** — "Seansı Bitir" (doğrudan `endSessionAction`) ve "Yarıda Kes" (modal + 4 reason: technical_issue/persona_wrong_fit/scenario_too_hard/user_interrupted) ayrı butonlar; değerlendirme tetiklenmez
- ✅ **P2-104** — Transcript özetleme: her 5. asistan mesajında QStash job; `session_summaries` tablosu (migration 033); rubric-aware LLM özet; chat API özet+son5 mesaj gönderir
- ✅ **P2-103** — Yarıda kesilen seans istatistik widget'ları
- ✅ **P2-104** — Transcript summarization background worker
- ✅ **P2-105** — Debrief akışı (farklı voice ID + AI-driven)
- ✅ **P2-106** — Super admin "Kullanıcı Geri Bildirimleri" sayfası
- ✅ **P2-107** — Sesli rapor TTS + Supabase Storage
- ✅ **P2-108** — Development plan aggregate worker
- ✅ **P2-109** — ICF + custom rubric seed migration
- ✅ **P2-110** — Persona seed + ElevenLabs voice ID eşleştirme (kısmi: voice ID'ler henüz atanmadı)
- ✅ **P2-111** — `/tenant/users/[id]` kişi detay dashboard
- ✅ **P2-112** — Dashboard + profilim widget güncellemeleri (`DevelopmentPlanWidget` eklendi)

### Phase 2 MVP Tamamlama (P2-001..P2-005) — tamamlandı

- ✅ **P2-001** — Email Adapter + Notification Service: `IEmailAdapter` interface, `ResendEmailAdapter`, singleton factory `getEmailAdapter()`. `NotificationService.createNotification()` DB insert + email. `notifications` tablosu (migration 039). `getMyNotifications()` + `getUnreadCount()` queries.
- ✅ **P2-002** — Evaluation retry UI + `evaluation_failed` state: migration 040 (`evaluation_failed` CHECK constraint + `overall_score` nullable). QStash retry header (`upstash-retried`) okunuyor; son denemede `evaluation_failed` upsert. `retryEvaluationAction()` + `RetryEvaluationButton` component. Rapor sayfasında hata UI + retry butonu.
- ✅ **P2-003** — `/dashboard/progress` gerçek içerik: stat kartları (Level/XP/Seans/Ort.Puan), `ScoreTrendChart`, `DimensionProgressCards`, seans tablosu, `DimensionRadarChart`, `DevelopmentPlanWidget`, `CancellationStatsWidget`.
- ✅ **P2-004** — `/dashboard/notifications` gerçek içerik: bildirim listesi, mark-as-read, mark-all-read. `/manager/team`: `getTeamMembers`, trend ikonları, user detail linkleri. `/manager/reports`: period filter + stats + leaderboard + radar chart. `.env.local.example` üç feature flag `true`.
- ✅ **P2-005** — `/admin/system` monitoring dashboard: platform istatistikleri + servis sağlığı kontrolleri + env probe + feature flags. Nav'a "Sistem Durumu" eklendi. Super admin only Server Component.

### Phase 3 — Production Hardening (devam ediyor)

- ✅ **P3-001** — Vitest + Playwright altyapısı, 68 unit test, e2e smoke. `npm test` yeşil.
- ✅ **P3-002** — GitHub Actions CI: lint → typecheck → test → build. ESLint pre-existing debt → warn.
- ✅ **P3-003** — `scripts/verify-migrations.mjs`: 6 kontrol (duplikat, gap, boş dosya, tehlikeli SQL, tablo coverage, format). CI'ye eklendi. PASS.
- ✅ **P3-004** — Adapter konsolidasyonu tamamlandı. `src/lib/adapters/stt.adapter.ts` + `tts.adapter.ts` silindi; STT/TTS route'ları `@/adapters/stt` + `@/adapters/tts` factory'lerine taşındı. `TTSOptions.voiceId` opsiyonel yapıldı; TTS route `stream()` async generator kullanıyor.
- ⏳ **P3-005** — Klasör rename (opsiyonel)
- ✅ **P3-006** — Production deploy runbook tamamlandı: `docs/runbook.md`. Env doldurma sırası, migration apply sırası, QStash cron schedule, Resend domain setup, rollback prosedürü, orphan cleanup, monitoring.
- ✅ **P3-007** — Konuşma bağlamı zenginleştirme tamamlandı. `tenants.context_profile JSONB` + `scenarios.role_context TEXT` (migration 041). `buildSystemPrompt()` kurum bağlamı + persona rol bağlamı bölümleri enjekte ediyor. Tenant admin `/tenant/settings` sayfasından `TenantContextForm` ile kurum profilini düzenleyebilir. Senaryo formu `role_context` alanı içeriyor.

### Deferred

- **Voice-only accessibility fallback** (Phase 3+) — mikrofon kullanamayan kullanıcılar için alternatif.
- ~~**Persona admin UI voice ID seçim**~~ ✅ **Tamamlandı (2026-04-26)** — PersonaForm "Ses Ayarı" kartı, super_admin only.
- **Voice cloning** (Phase 3+) — ElevenLabs custom voice upgrade.

### Doc Update Rule

Her başarıyla tamamlanan task sonrasında `CLAUDE.md`, `AGENTS.md`, `README.md` ve `yol_haritasi_20260424.md` ilgili bölümleri güncellenir. Hatırlatma gerekmez.

### Dev Server Notes (issue resolved 2026-04-23)

- Stray `/Users/ozcanbalioglu/projeler/{package.json,package-lock.json,node_modules/}` was deleted (had been accidentally created 2026-04-19, caused Turbopack to pick the wrong workspace root and fail to resolve `tailwindcss`).
- `next.config.ts` now has explicit `turbopack.root: path.resolve(__dirname)` to prevent re-emergence.
- If `npm run dev` ever fails with "Can't resolve 'tailwindcss' in /Users/ozcanbalioglu/projeler/AIUON MIRROR": stop all node processes, `rm -rf .next`, confirm no new stray `package.json` exists above the project, then restart.
- Folder name `AIUON MIRROR` still contains a space — candidate for Phase 0 reproducibility cleanup (rename to `AION_MIRROR` or `aion-mirror`), but not blocking.

---

## Architecture Overview

**AION Mirror** is a multi-tenant SaaS platform for AI-driven roleplay coaching. End users conduct **voice** roleplay sessions with AI personas to practice managerial conversations. After the session, a different voice AI coach runs a 1-2 minute debrief conversation while the evaluation LLM generates the report in parallel. Final report is then played back to the user with a dedicated voice summary. Text mode removed in Phase 2 (ADR-011).

### Role Hierarchy

Six roles with additive access. Defined in `src/types/index.ts` as `UserRole`:

| Role | Access |
|---|---|
| `user` | Own sessions, progress, achievements |
| `manager` | Above + team reporting |
| `hr_admin` | Reporting across the tenant |
| `hr_viewer` | Read-only reporting |
| `tenant_admin` | Full tenant management (users, personas, scenarios, gamification) |
| `super_admin` | Platform-level (all tenants, prompt templates, rubric config) |

Route protection is enforced in `middleware.ts` (coarse) and re-checked in layouts and server actions (fine). `src/lib/navigation.ts` maps each role to its nav config.

### Supabase Clients

Two clients in `src/lib/supabase/server.ts`:

- `createClient()` — SSR client using the current user's cookie session. Respects RLS. Use this in server actions and page components.
- `createServiceRoleClient()` — service-role key, bypasses RLS entirely. Use **only** in trusted server contexts (e.g., building system prompts, writing evaluation results, prompt log encryption). Never expose the service role key to client code.

Persona and scenario access follows: `tenant_id = current user's tenant` OR `tenant_id IS NULL` (global/shared content).

### Session Lifecycle

```
pending → active → completed
                 → dropped (heartbeat timeout, recoverable for 2h)
                 → cancelled
                 → failed (streaming error)
```

Key actions in `src/lib/actions/session.actions.ts`:

- `createSessionAction` — creates the session record in `pending` state
- `activateSessionAction` — builds the system prompt via `buildSystemPrompt()`, encrypts it, stores in `prompt_logs`, then transitions to `active`
- `endSessionAction` — transitions to `completed` and enqueues the evaluation job
- Session page at `/dashboard/sessions/[id]` auto-activates pending sessions on render

### Adapter Layer

`src/adapters/` provides swappable implementations for external AI services:

- `llm/` — `ILLMAdapter` with `chat()` and `streamChat()`. Current impl: OpenAI (`OPENAI_API_KEY`, model from `OPENAI_LLM_MODEL`, defaults to `gpt-4o`).
- `stt/` — Speech-to-text. Current impl: OpenAI Whisper.
- `tts/` — Text-to-speech. Current impl: ElevenLabs (`ELEVENLABS_API_KEY`).

### Chat API & Streaming

`POST /api/sessions/[id]/chat` is an SSE endpoint. It:
1. Validates session ownership and `active` status.
2. Fetches the encrypted system prompt from `prompt_logs` and decrypts it.
3. Calls `llm.streamChat()` and forwards chunks as `data: {"text": "..."}` SSE events.
4. Parses `[PHASE:...]` markers in the response to track conversation phase (`opening → exploration → deepening → action → closing`).
5. Detects `[SESSION_END]` marker and auto-completes the session.

Client state is managed by Zustand in `src/stores/session.store.ts` (text) and `src/stores/voice-session.store.ts` (voice).

### Evaluation Pipeline

After `endSessionAction`, an Upstash QStash job is published to `POST /api/sessions/[id]/evaluate` with a 5-second delay and 3 retries. The evaluation engine (`src/lib/evaluation/evaluation.engine.ts`) calls GPT with `response_format: json_object` and persists results to `evaluations` and `dimension_scores` tables. System prompts and evaluation prompts are AES-GCM encrypted before storage (`src/lib/encryption/aes-gcm.ts`).

### Key Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_LLM_MODEL          # defaults to gpt-4o
ELEVENLABS_API_KEY
UPSTASH_QSTASH_TOKEN
UPSTASH_QSTASH_CURRENT_SIGNING_KEY
UPSTASH_QSTASH_NEXT_SIGNING_KEY
QSTASH_RECEIVER_URL       # public URL for QStash callbacks
ENCRYPTION_KEY            # AES-GCM key for prompt encryption
RESEND_API_KEY            # Email delivery (invite + OTP)
APP_ENV                   # e.g. development | staging | production
```

### Data Layer Conventions

- **Read queries** live in `src/lib/queries/` — plain async functions returning typed data.
- **Mutations** live in `src/lib/actions/` — `'use server'` files, validated with Zod, always call `revalidatePath` after successful writes.
- **Auth helper**: `getCurrentUser()` in `src/lib/auth.ts` (thin re-export from `src/modules/auth/service.ts`) returns the full `AppUser` profile or `null`.

### Front-end Conventions

- UI primitives come from shadcn/ui (`src/components/ui/`) backed by Radix.
- `react-hook-form` + Zod for all forms. Use `useServerAction` hook (`src/hooks/useServerAction.ts`) to call server actions from client components.
- Toast notifications: `src/lib/toast.ts` wraps `sonner`.
- Gamification weekly challenges are assigned via a cron route at `POST /api/cron/assign-weekly-challenges`.
