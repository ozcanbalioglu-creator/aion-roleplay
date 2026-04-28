# Canlı Yayına Çıkış Planı — 1 Mayıs 2026 Hedefi

**Oluşturulma:** 2026-04-25
**Son güncelleme:** 2026-04-26 (sesli seans katmanı stabilize edildi, role-inversion fix uygulandı)
**Hedef tarih:** 2026-05-01 (test kullanıcılarıyla canlı simülasyon)
**Toplam süre:** 6 iş günü
**Mevcut durum:** Yeşil — bloker yok, voice akışı uçtan uca çalışıyor

---

## Karar Defteri (Bu Konuşmalarda Bir Daha Açılmayacak)

Aşağıdaki kararlar 2026-04-25 tarihli oturumda kesinleşti. **Bunları yeniden tartışmaya açma.**

### K-001 — Veritabanı Stratejisi (1 Mayıs Öncesi)

- **Geliştirme + test:** Sadece **Staging DB** kullanılacak (`Aion_Mirror_Staging`)
- **Production DB:** 1 Mayıs deploy zamanına kadar dokunulmayacak. Şu an boş kabuk halinde, gerçek veri yok.
- **Lokal DB yok:** `npm run dev` doğrudan Staging'e bağlanır. Lokal Supabase Docker kullanılmıyor.
- **`.env.local`** ve **`.env.staging`** her ikisi de Staging DB'ye bakar. **`.env.production`** henüz YOK — deploy zamanı oluşturulacak.

### K-002 — Auth Akışı

- **Yöntem:** Sadece passwordless OTP — `inviteUserByEmail` ile davet, sonra 6 haneli kod ile giriş.
- **Şifre yok.** Hiçbir yerde "geçici şifre" yaratılmayacak. ADR-010 geçerli.
- **Login sayfası:** SSO ve "Davet kodun mu var?" placeholder butonları kaldırıldı (2026-04-25).

### K-003 — ElevenLabs

- **Plan:** Creative (TTS API). Agents değil.
- **Voice ID'ler:** Persona başına 1 voice ID + 1 debrief koçu voice ID
- **Env:** `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_VOICE_ID`, `ELEVENLABS_DEBRIEF_COACH_VOICE_ID`
- **Persona voice ID'ler DB'de** (`personas.voice_id` kolonu)

### K-004 — Mimari Kavram

- **Tek kod / proje / klasör.** Birden fazla "proje klasörü" yapılmayacak.
- **Database farklı, kod aynı.** Sadece `.env` dosyası değişir.
- **Migration dosyaları tek yerde** (`supabase/migrations/`), her DB'ye ayrı uygulanır.

---

## 6 Günlük Sprint Planı

### Gün 1 — 25 Nisan

- [x] Login sayfasındaki SSO + davet kodu butonlarını kaldır
- [x] Karar defteri belgelendi (bu doküman)
- [x] **ElevenLabs hesap aç → API key al → Creative planı**
- [x] `.env.local`'e `ELEVENLABS_API_KEY` ekle
- [x] Voice library'den persona başına voice ID seç (en az 1 persona için tamamlandı, kalanlar için süper admin form kullanılabilir)
- [x] Debrief koçu için ayrı bir voice ID seç (tok, kararlı bir ses)
- [x] Persona voice ID atama — **artık SQL gerekmez**: süper admin Persona düzenleme formu üzerinden atayabiliyor (PersonaForm "Ses Ayarı" kartı, `voice_id` DB kolonu)
- [x] `.env.local`'e `ELEVENLABS_DEFAULT_VOICE_ID` + `ELEVENLABS_DEBRIEF_COACH_VOICE_ID` ekle

### ✅ VAD-001 Çözüldü (2026-04-26)

Önceki blocker olan mikrofon ses algılaması sorunu çözüldü:
- **Kök neden:** Chrome Web Audio API graf optimizasyonu (destination'a bağlı olmayan graflar üzerinde `MediaStreamAudioSourceNode` veri üretmiyor).
- **Fix:** `analyser → muteGain(gain=0) → ctx.destination` bağlantısı (echo yok, graf canlı kalıyor) + `ScriptProcessorNode` → `AnalyserNode + MediaRecorder` mimarisi.
- **Cross-browser:** Chrome, Edge, Safari ve Firefox'ta çalışıyor (feature detection ile).
- Detay: `CLAUDE.md` → "Hata Kaydı — Sesli Seans Katmanı"

---

### Gün 2-3 — 26-27 Nisan (Uçtan Uca Test) ✅ Devam ediyor

- [x] `npm run dev` aç, browser'da kendi hesabınla giriş yap
- [x] Bir seansı tam yaşa: persona seç → mikrofon başlat → konuş → bitir (defalarca test edildi 2026-04-26)
- [ ] Debrief sohbetini tamamla — **"Geri bildirime başla" butonu ile** (DEBRIEF-AUTOPLAY-001 fix sonrası)
- [ ] Sesli rapor üretilsin, dinle
- [ ] Yarıda kesme akışını test et (4 reason'dan biri)
- [ ] Yeni kullanıcı davet et (kendi farklı bir e-postanla), invite mailini al, OTP ile gir
- [ ] Bulk upload — küçük bir CSV dene
- [ ] Hataları `notlar/hata_listesi.md` gibi bir dosyaya topla

#### 2026-04-26 Test Oturumunda Tespit Edilen ve Çözülen Hatalar

11 ayrı bug tespit edildi ve düzeltildi (detaylar `CLAUDE.md` → "Hata Kaydı — Sesli Seans Katmanı"):

| ID | Sorun | Durum |
|---|---|---|
| VAD-001 | Chrome Web Audio graf optimizasyonu | ✅ |
| VAD-002 | Zustand stale state → VAD erken başlatma | ✅ |
| STT-001 | Safari `audio/mp4` MIME uyumsuzluğu | ✅ |
| CHAT-001 | Barge-in abort → session `failed` | ✅ |
| HISTORY-001 | `session_messages` schema mismatch (migration 046 uygulandı) | ✅ |
| TTS-001 | Safari chunked MP3 sessiz hata | ✅ |
| ENV-001 | `OPENAI_LLM_MODEL=gpt-5.4` → `gpt-4o` | ✅ |
| VOICE-001 | Persona `voice_id` DB'den TTS'e akmıyordu | ✅ |
| AUDIO-001 | Browser autoplay policy → `play() reddedildi` | ✅ |
| STT-PHANTOM-001 | Whisper Türkçe halüsinasyonları ("Altyazı M.K." vb.) | ✅ |
| TTS-ECHO-001 | Hoparlör→mic echo VAD'ı tetikliyor | ✅ |
| PROMPT-EARLYEND-001 | AI 5-6 turda erken `[SESSION_END]` | ✅ |
| END-001 | "Seansı Bitir" sessiz fail | ✅ |
| DEBRIEF-AUTOPLAY-001 | Debrief auto-start, refresh sonrası autoplay reddi | ✅ |
| **ROLE-INVERSION-001** | **AI koç gibi davranıyordu (kritik ürün hatası)** | ✅ |
| MARKER-LEAK-001 | "Phase Opening" bracket'sız ifade TTS'e sızıyor | ✅ |
| END-RACE-001 | AI auto-end + user-end race | ✅ |

### Gün 4 — 28 Nisan (Hata Düzeltme)

- [ ] Test sırasında bulunan hataları sırayla düzelt
- [ ] Düzeltme sonrası ilgili senaryoyu yeniden test et
- [ ] Tüm test geçerse → "deployment hazır" işareti

### Gün 5 — 29 Nisan (Production Hazırlığı)

- [ ] Production DB'yi sıfırla:
  - Supabase Dashboard → Aion_Mirror → SQL Editor
  - **Tüm tabloları drop** (veya yeni proje aç, daha temiz)
  - `supabase/migrations/` altındaki tüm SQL'leri sırayla çalıştır (001 → 041)
- [ ] Production'da Auth → SMTP (Resend) ayarla
- [ ] Production'da Storage bucket'ları (`avatars`, `tenants`, `report-audio`) oluştur
- [ ] Vercel'de project oluştur (varsa, mevcut)
- [ ] Vercel → Settings → Environment Variables → tüm production env'lerini doldur
- [ ] `.env.production` lokalde oluştur (gizli — `.gitignore`'da)
- [ ] QStash'te production receiver URL'ini ayarla
- [ ] Resend'de production sender domain'i (`mirror.aionmore.com`) doğrula

### Gün 6 — 30 Nisan (Soft Launch)

- [ ] Vercel'e production branch push → deploy
- [ ] Production URL üzerinden kendi hesabınla bir seans yap
- [ ] Her şey çalışıyorsa → 1 Mayıs için test kullanıcılarını davet et
- [ ] Davet listesini hazırla (kim, hangi e-posta, hangi rol)

### 1 Mayıs — Canlı

- [ ] Test kullanıcılarını davet et (`InviteUserDialog` veya bulk upload)
- [ ] Kullanıcılar OTP ile girebildiğini doğrula
- [ ] Slack/WhatsApp'tan kullanıcılara "ne yapacaklar" yönergesi
- [ ] Logları/dashboard'u izle, hata olursa anında müdahale

---

## Risk ve Acil Durum Planı

| Risk | Olasılık | Önlem |
|---|---|---|
| ElevenLabs voice quota'ı yetmez | Düşük | Creative free tier 10K karakter; 5-10 seans için yeter |
| Production migration'ı çalışmaz | Orta | Önce staging'i sıfırla → migration sırasını test et → sonra prod |
| Resend domain'i 1 Mayıs'a yetişmez | Orta | Bugün bakılacak — DNS propagation 24-48 saat olabilir |
| QStash retry hataları | Düşük | `evaluation_failed` UI zaten yapıldı (P2-002) |
| Test kullanıcısı OTP almıyor | Düşük | Resend logs + Supabase auth logs kontrol |

---

## Erteleme Listesi (1 Mayıs Sonrası)

Bunlar **launch'a engel değil**, ama unutulmasın:

- ESLint 150 warning temizliği (P3-005)
- ICF rubric'in admin panelden düzenlenebilirliği
- ~~Persona admin UI'da voice ID seçimi~~ ✅ **Tamamlandı (2026-04-26)** — PersonaForm "Ses Ayarı" kartı
- Voice cloning (custom ElevenLabs voice)
- Voice-only fallback (mikrofon olmayan kullanıcılar için text mode geri dönüşü)
- Production'daki ekstra/orphan kolonlar (sıfırlanınca temizlenecek)
- **Pre-Launch Phase 1** (Persona Roleplay Sözleşmesi parametrikleştirme) — `Pre_Launch_Phase_1.md`. Süre ~4.5 saat, risk düşük. Yetişebilirse launch öncesi de yapılabilir; yetişmezse hatırlatma 4 Mayıs'a planlandı.
- **Post-Launch Phase 2** (Tam parametrik roleplay mimarisi: mode preset'ler + dinamik faz taksonomisi + evaluation target) — `Post_Launch_Phase_2.md`. Süre ~2 hafta. Phase 1 tamamlandıktan sonra başlatılır.

---

## İlgili Belgeler

- [`Pre_Launch_Phase_1.md`](Pre_Launch_Phase_1.md) — Roleplay sözleşmesini parametrikleştiren minimum viable refactor (low-risk, 4.5 saat)
- [`Post_Launch_Phase_2.md`](Post_Launch_Phase_2.md) — Tam parametrik roleplay mimarisi (mode preset'ler, dinamik faz, evaluation target — ~2 hafta)
- `mimari_kararlar_20260423.md` — ADR-016: Parametrik Roleplay Sözleşmesi (Phase 1+2'nin mimari kararı)

---

## Bu Belgeyi Güncelleme Kuralı

Her gün sprint planındaki ilgili checkbox'ları işaretle. 1 Mayıs sonrası bu belge arşive kaldırılır (`Gelistirme23Nisan/_arsiv/` klasörü altına).
