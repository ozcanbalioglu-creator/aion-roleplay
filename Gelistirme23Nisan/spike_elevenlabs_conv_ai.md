# ElevenLabs Conversational AI — Spike Planı

**Tarih:** 2026-05-02
**Branch:** `feat/voice-elevenlabs-spike`
**Worktree:** `../aion-realtime-spike` (paralel, main hiç dokunulmaz)
**Süre:** 3-4 gün
**Kapsam:** Tek persona (önerim: **Murat Kaya**) ile uçtan uca POC

---

## Hedef

ElevenLabs Conversational AI'nın AION Mirror için sürdürülebilir olup olmadığına net karar vermek. Karar matrisi:

| Sonuç | Karar |
|---|---|
| Latency ≤400ms + Türkçe ses kalitesi mevcut sistemle aynı/daha iyi + maliyet 5dk seans için ≤$1.50 | ✅ **Geç** — implementation faz'ına git |
| Latency 400-800ms ama ses kalitesi iyi | ⚠️ **Hibrit** — kullanıcıya seçenek sun |
| Latency >800ms VEYA ses dramatik düşük VEYA maliyet >$2/seans | ❌ **Bırak** — mevcut Whisper+ElevenLabs'da kal, OpenAI Realtime'ı dene |

---

## Ölçüm Metrikleri (her test seansında kayıt)

1. **First-audio latency:** Kullanıcı konuşmayı bitirdiği andan AI sesinin ilk byte'ına kadar (ms)
2. **Turn latency:** AI cevabının tamamlanmasına kadar (ms)
3. **Türkçe STT doğruluğu:** Manuel: 100 kelimenin kaçı doğru transkript edildi (%)
4. **Phantom transkript oranı:** Sessizken AI'a giden hayalet mesaj sayısı / toplam tur
5. **Barge-in tepki süresi:** Kullanıcı AI'ı kestiğinde AI'ın susma süresi (ms)
6. **Maliyet:** 5 dakikalık seans ücreti ($)
7. **Subjektif ses kalitesi:** Murat Kaya ElevenLabs voice ID'si Conv. AI üzerinden aynı doğallıkta mı?

Her seansa **mevcut prod akışıyla A/B karşılaştırma** zorunlu. Aynı persona, aynı senaryo, art arda 2 seans.

---

## Mimari Karar — Static vs Dynamic Agent

ElevenLabs Conv. AI iki yapılandırma yolu sunar:

### A) Static Agent (Dashboard'dan config)
- Agent ElevenLabs Dashboard'da yaratılır
- System prompt, voice, LLM, tools UI'dan girilir
- Frontend sadece `agent_id` ile bağlanır

**Sorun:** Mevcut `buildSystemPrompt()` mimarisi atlanır — rubric, phase, role-reminder, persona contract birleşik prompt YAPILANDIRMASI kaybolur. Spike için hızlı ama production'a taşınmaz.

### B) Dynamic Override (önerilen) ✅
- Agent dashboard'da minimal kalır
- Bağlanırken `overrides.agent.prompt.prompt` parametresiyle runtime system prompt gönderilir
- Mevcut `buildSystemPrompt()` çağrısı korunur, çıktısı agent'a pass edilir
- Persona değişimi = farklı override, agent değil

**Karar:** Yol B. Spike kodu da B üzerine kurulacak.

---

## 4 Günlük Plan

### Gün 1 — Setup (3-4 saat)

**Kullanıcı tarafı:**
1. ElevenLabs Pro/Creator hesabı doğrula (Conversational AI free tier 10dk/ay; gerçek test için Pro gerekli)
2. ElevenLabs Dashboard → **Conversational AI → Agents → Create**
   - **Voice:** Murat Kaya'nın mevcut voice ID'si
   - **LLM:** GPT-4o (custom LLM seçeneği — OpenAI API key Conv. AI'a verilir veya ElevenLabs'in default'u)
   - **System prompt:** Geçici placeholder ("Bu prompt runtime'da override edilecek")
   - **First message:** Boş bırak (override'da gelecek)
   - **Language:** Turkish
3. Agent ID'yi kaydet → `ELEVENLABS_AGENT_ID_MURAT` env'i olarak Vercel'e ve worktree'ye gir

**Claude tarafı:**
1. `npm install @elevenlabs/client` (worktree'de)
2. `src/adapters/realtime/` klasör + interface
3. `.env.local.example` güncelle

### Gün 2 — POC Sayfası (4-6 saat)

`/realtime-spike/[personaId]` rotası — mevcut auth zincirini kullanır ama tamamen yeni bir voice client.

**Akış:**
1. Server: persona + senaryo seç → `buildSystemPrompt()` çağır → çıktı dönüyor
2. Client: ElevenLabs `useConversation` hook'u + `agent_id` + override system prompt + `dynamic_variables: { user_name }`
3. WebSocket bağlantı kurulur
4. Mikrofon butonu → kullanıcı konuşur → server VAD detect → AI cevap verir
5. Transcript event'lerini DB'ye kaydet (mevcut `session_messages` schema'sı)
6. Bitir → mevcut `endSessionAction` zinciri (debrief + evaluation aynen çalışmalı)

**Ölçüm enjeksiyonu:** Her event'e `performance.now()` timestamp; metrikleri DB'ye `realtime_metrics` tablosu olarak kaydet (yeni migration sadece spike için).

### Gün 3 — A/B Test (4-6 saat)

10 test seansı (5 mevcut prod akışı, 5 ElevenLabs Conv. AI):
- Her ikisinde aynı senaryo (örn. "Performans değerlendirme görüşmesi")
- Murat Kaya voice
- 5 dakikalık konuşma
- Aynı kullanıcı (sen)

Sonuçları **`spike_elevenlabs_conv_ai.md` sonuna** tablo halinde işle.

### Gün 4 — Karar Belgesi (2-3 saat)

Bu belgenin sonuna **Karar bölümü** ekle:
- Ölçüm tablosu (10 seans ortalama)
- Subjektif değerlendirme (3 paragraf)
- Karar (Geç / Hibrit / Bırak)
- Yapılacaklar listesi (Geç ise: implementation faz'ı planı; Bırak ise: mimari öğreni)

---

## Riskler ve Mitigasyon

| Risk | Etki | Mitigasyon |
|---|---|---|
| ElevenLabs Conv. AI Türkçe destek olgunlaşmamış olabilir | Yüksek | Gün 1 sonu "Hello world" agent ile 10 dk Türkçe test → erken sinyal |
| Dynamic override system prompt 8000+ char'a kısıtlı olabilir | Orta | Gün 1: en uzun prompt'u test et (rubric+contract+phase = ~5000 char) |
| GPT-4o LLM Conv. AI içinde yapılandırması karmaşık | Orta | Custom LLM seçeneği yerine ElevenLabs'in default'unu dene; sonuç farklıysa migration |
| WebSocket Vercel Edge Function süre limiti (300sn) seansı keser | Düşük | 5 dk seans 300sn'in altında. Daha uzun seanslar için reconnect logic post-spike |
| Maliyet beklenenin üstünde | Düşük | Gün 1 sonu Conv. AI fiyatlandırma sayfasını net oku, 5dk simulate et |

---

## Spike Sonrası — Ne Olmaz

- ❌ Mevcut prod akışı değişmez (worktree main'e merge edilmez)
- ❌ Migration yazılmaz (sadece spike-only `realtime_metrics` tablosu var, o da test bitince drop edilebilir)
- ❌ Diğer 4 persona için config yapılmaz (sadece Murat Kaya)
- ❌ Klasik adapter silinmez veya deprecate edilmez

---

## Spike Sonrası — Olumlu Sonuç Çıkarsa Ne Olur

ADR-017 yazılır: "ElevenLabs Conversational AI adapter eklendi". Sonra implementation faz'ına geçilir (önceki yol haritası Faz C-F):
- Persona engine_preference kolonu (migration 053)
- 5 persona için Conv. AI agent config
- Feature flag `realtimeVoice`
- Pilot tenant rollout

---

## Faz B — Prompt Integration (2026-05-02)

İlk Faz A testi sonrası persona davranışının tutarsız olduğunu (koç gibi davranma, oryantasyon programı tasarlama) gördük. Sorun mimari değil, prompt aktarımı eksikliğiydi: spike'ta minimal 70 satırlık manuel prompt vardı, mevcut prod ise `buildSystemPrompt()` ile tenant context + persona contract + ICF rubric + role-reminder + faz direktifleri zincirini kullanıyor.

### P1 Keşif — Mimari Karar (kabul edildi)

`src/lib/session/system-prompt.builder.ts`:
- `buildSystemPrompt({ sessionId, personaId, scenarioId, tenantId })` — `sessionId` **parametre olarak alınıyor ama function gövdesinde HİÇ kullanılmıyor**
- Sadece persona/scenario/tenant ID'leri DB sorgusu için gerekli
- Persona prompt versiyonu encryption ile DB'de — `decrypt()` ile çözülüyor

**Karar: Wrapper YAZMIYORUZ.** Mevcut fonksiyon zaten session-bağımsız; spike endpoint'inden direkt import + dummy `sessionId` geç. Bu, plan'daki P2 süresini 1.5 saatten 30 dakikaya indirir.

**Eleminasyonun gerekçesi:**
- Wrapper (a): Gereksiz duplikasyon, mevcut fonksiyon zaten saf
- Refactor (b): Kapsam dışı, prod kodunu spike sırasında değiştirme riski
- Geçici session (c): DB kirliliği, evaluation tetiklenmesi, yan etki

**Tek pürüz — `scenarioId` zorunlu:**
Function imzasında `scenarioId: string`. Spike URL'sinde scenario opsiyonel. Çözüm: spike sayfasında basit scenario picker eklenir, kullanıcı persona seçtikten sonra senaryo seçer; URL'ye query param olarak gider (`/realtime-spike/[personaId]?scenario=[scenarioId]`).

### P2-P3 Implementation

- `signed-url/route.ts`: minimal manuel prompt build kaldırıldı, `buildSystemPrompt({ sessionId: 'spike', personaId, scenarioId, tenantId })` çağrısı
- Tenant ID auth user'ından çözülür (`users.tenant_id` lookup)
- Spike sayfası scenario picker eklendi
- Override.prompt'a tam ~5000+ char production prompt aktarılır

### P4 A/B Test sonuçları

(test sonrası doldurulacak)

### P5 Final Karar

(test sonrası doldurulacak)

---

## İlgili Dosyalar

- `Gelistirme23Nisan/Post_Launch_Iyilestirmeler.md` — R&D-001 (OpenAI Realtime) ile ilişki
- `Gelistirme23Nisan/mimari_kararlar_20260423.md` — ADR-017 burada yazılacak (spike olumluysa)
- `src/lib/session/system-prompt.builder.ts` — `buildSystemPrompt()` aynen kullanılacak
- `src/adapters/tts/elevenlabs.adapter.ts` — referans için (Conv. AI farklı API ama aynı vendor)
