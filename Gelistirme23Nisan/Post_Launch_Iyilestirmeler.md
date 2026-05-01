# Post-Launch İyileştirmeler — Yapılacaklar Listesi

> **GÜNCELLEME 2026-04-30:** PR #1 (rapor mimarisi + landing page) Vercel preview'de test edildiğinde 9 yeni iş kalemi tespit edildi. Detaylı liste: [`pr1_sonrasi_tespit_edilen_iyilestirmeler_20260430.md`](pr1_sonrasi_tespit_edilen_iyilestirmeler_20260430.md).
>
> **GÜNCELLEME 2026-05-01 (sprint sonu):** B2/B3/B4/U1/U2 + radar redesign + asset'ler + parçalı sorgu refactor (10 commit) tamamlandı. **F4 (Dashboard+Gelişimim birleştirme)** post-launch P1'e eklendi — font tutarsızlığı kritik nokta olarak işaretlendi.
>
> **GÜNCELLEME 2026-05-01 (cleanup):** Tamamlanmış P2 maddeler bu listeden kaldırıldı:
> - `P2-UX-001` (Senaryo seçim sidebar gap) → çözüldü olarak `UX-SIDEBAR-GAP-001`
> - `P2-UX-002` (Voice session redesign) → çözüldü olarak `UX-VOICE-LAYOUT-001`
> - Bonus: `UX-PERSONA-LAYOUT-001` (PersonaInfoColumn) belge dışında planlanıp uygulandı
>
> Kalıcı log: `CLAUDE.md` → "Hata Kaydı — Sesli Seans Katmanı".
>
> **GÜNCELLEME 2026-05-01 (P2-Cost-001 UI netleştirme):** Super admin maliyet dashboard'unun temel görünümü tenant tablosu (Kurum Adı | LLM | STT | TTS | Toplam) + satır click ile expandable kullanıcı sub-table olarak spec edildi. Detay: `P2-Cost-001 → Hedeflenen Görünümler`.
>
> **GÜNCELLEME 2026-05-01 (P1-Roleplay-002 eklendi):** Test sırasında tespit edildi: senaryo bağlamı persona system_prompt'u tarafından eziliyor (Aylin Çelik + "İlk Sunum Heyecanı" → A sınıfı doktor konusu açıldı). Hard-code değil, prompt mimarisi sorunu. Üç çözüm yolu (data hygiene / structural / Phase 2 mimari ayrımı) listelendi.

**Hazırlık tarihi:** 2026-04-27
**Bağlam:** 1 Mayıs 2026 launch sonrası dönem için biriktirilen iyileştirme önerileri.
**Kapsam:** Pre-launch sprint sırasında tespit edilen ama launch riskini almak istemediğimiz veya post-launch için daha uygun gelişmeler.
**Önceliklendirme:** Etki / efor / risk üçgeninde değerlendirilmiş; ilk gözden geçirme launch sonrası ilk hafta yapılır.

---

## Sınıflandırma Kuralları

| Kategori | Tanım |
|---|---|
| 🔴 P1 | Yüksek etki, post-launch ilk 2 hafta içinde |
| 🟡 P2 | Orta etki, post-launch ilk ay içinde |
| 🟢 P3 | Düşük etki / iyileştirme niteliğinde, fırsat oldukça |
| 🔵 R&D | Araştırma / değerlendirme gereken; karar sonra |

---

## 🔴 P1 — İlk 2 Hafta İçinde

### P1-UX-001 — Dashboard + Gelişimim Sayfa Birleştirme (F4)

**Bağlam:** Dashboard ve Gelişimim sayfaları yaklaşık %70 örtüşüyor (Toplam DP, Tamamlanan Seans, Ort. Puan, Skor Trendi, Boyut Radar her iki sayfada da var). Kullanıcı için "veri için neresi?" cognitive yükü yaratıyor.

**Çözüm:** Tek "Dashboard" sayfası altında üç katmanlı bilgi mimarisi:
- ÜSTTE: Stat kartları (Tamamlanan, Ort. Puan, DP, Streak)
- ORTADA: Aktivite (Skor Trendi + Persona Bazlı + Son Seanslar)
- ALTTA: Gelişim (Radar + Aylık Kıyas + Boyut Detay) + Yarıda Bırakılanlar
- YANDA: Hedefler (Haftalık Görevler + Gelişim Planı)

`/dashboard/progress` sidebar'dan kaldırılır, eski URL `/dashboard`'a redirect.

**⚠️ KRİTİK NOT — FONT TUTARSIZLIĞI:**
Dashboard ve Gelişimim sayfaları şu an **farklı font sistemleri** kullanıyor (başlık ve gövde fontları farklı uygulanmış). Birleştirme yaparken **Dashboard fontu standart kabul edilmeli**, tüm widget'lar bu sistemi kullanmalı:
- Page title: `font-headline italic`
- Section başlık: `font-headline`
- Stat label: `font-body uppercase tracking-wider text-[10px] font-bold`
- Veri/sayı: `font-body tabular-nums`
- Body metin: `font-body`

Acceptance: "Tüm widget'lar Dashboard font sistemi ile uyumlu görünüyor."

**Aksiyon:**
1. `dashboard/progress/page.tsx` widget'larını `dashboard/page.tsx`'e taşı
2. `CancellationStatsWidget` (Yarıda Bırakılan) Dashboard'a ekle
3. `dashboard/progress/page.tsx` → `redirect('/dashboard')`
4. `navigation.ts`'ten "Gelişimim" sidebar item'ını kaldır
5. Mobil nav (`MobileNav`) "Gelişim" → "Ana Sayfa" yönlendirmesini güncelle
6. **Tüm widget font'larını Dashboard standardına hizala** (en kritik adım)

**Tahmini süre:** 2-3 saat

**Önkoşul:** Lansman sonrası en az 1 hafta gerçek kullanım — kullanıcılar mevcut akışa alıştıktan sonra birleştirme yapılırsa "kayıp" hissini minimize eder.

**Detaylı plan:** [`pr1_sonrasi_tespit_edilen_iyilestirmeler_20260430.md`](pr1_sonrasi_tespit_edilen_iyilestirmeler_20260430.md) → F4

---

### P1-Voice-001 — STT Servisi Upgrade Değerlendirmesi

**Bağlam:** OpenAI Whisper-1 modeli 2023 sürümü. Türkçe halüsinasyonları (YouTube altyazı kredilerinden öğrenilmiş) sürekli yama gerektiriyor:
- Phantom regex listesi (10+ pattern)
- Min length check
- Anti-prompt
- Türkçe locale-aware lowercase

Yamalar hafif kalsa da hata yüzeyi büyüyor. Modern alternatifler:

| Servis | Avantaj | Dezavantaj | Geçiş Eforu |
|---|---|---|---|
| **`gpt-4o-mini-transcribe`** (OpenAI 2025) | Aynı API, drop-in. GPT-4o tabanlı, halüsinasyon ~%90 azalır | Aynı sağlayıcıda kalıyoruz | 1 satır (`model: 'gpt-4o-mini-transcribe'`) |
| **Deepgram Nova-2** | Türkçe için iyi, halüsinasyon yok, real-time | Yeni hesap, ayrı fatura, REST API farklı | 1 gün adapter implementasyonu |
| **OpenAI Realtime API** | STT+LLM+TTS tek pipeline, latency 100ms | WebRTC, büyük refactor | 2-3 hafta |

**Önerilen sıralama:**
1. **Önce `gpt-4o-mini-transcribe` denemesi** — risk en düşük, 30 dakikada test edilir
2. Halüsinasyonlar hâlâ varsa → Deepgram adapter
3. Realtime API → Phase 3+ planlaması

**Acceptance:** STT-PHANTOM-001 tetiklenme oranı %90+ azalmalı; phantom regex listesi guardrail olarak korunur.

**Tahmini süre:** 2-4 saat (gpt-4o-mini-transcribe), 1 gün (Deepgram)

---

### P1-Roleplay-001 — Persona Roleplay Sözleşmesi Parametrikleştirme (Phase 1)

**Belge:** `Pre_Launch_Phase_1.md` (ayrı plan, hazır)

**Özet:** Mevcut hard-coded `roleReminder` `system-prompt.builder.ts`'te. Persona kaydına 2 yeni opsiyonel kolon (`roleplay_contract`, `opening_directive`) eklenir. Backward-compatible fallback ile zero-regression.

**Tahmini süre:** ~4.5 saat

---

### P1-Roleplay-002 — Senaryo Bağlamı Persona System Prompt'u Tarafından Eziliyor

**Bağlam (2026-05-01 test):** Aylin/Selin Çelik personasıyla "İlk Sunum Heyecanı" senaryosu seçildi. Senaryo açıklaması: "ertesi gün yönetim kuruluna sunum yapılacak, sunum heyecanı için koçluk." Ancak seans başlayınca persona "A sınıfı doktorlardan randevu alamıyorum, bu yüzden reçete yazılmıyor" konusunu açtı — senaryo tamamen iptal oldu.

**Hard-code değil — prompt mimarisi sorunu.** Sistem prompt birleşim sırası ([system-prompt.builder.ts:233](src/lib/session/system-prompt.builder.ts:233)):

```
1. decryptedPersonaPrompt    ← admin form'unda yazılan ZENGİN backstory (~1500-3000 tok)
2. roleplay_contract          ← Phase 1 parametrik kontrat
3. tenant context
4. scenario.role_context      ← persona-spesifik seans durumu (OPSİYONEL)
5. persona behavior params
6. kpi
7. scenario.context_setup     ← senaryo bağlamı (yöneticinin görüş açısı)
8. rubric
9. phase directives
```

İki ayrı kök neden olası:

**A) Persona system_prompt'u senaryo-spesifik durum içeriyor** — Süper admin Aylin'i oluştururken `persona_prompt_versions.content_encrypted`'a "A sınıfı doktor zorluğu, redden korkma..." gibi kalıcı dertler yazmış. Bu metin en başta + en uzun → LLM persona'nın kalıcı backstory'sine kilitleniyor, senaryo 7. sırada zayıf kalıyor.

**B) Yeni senaryonun `role_context` alanı boş** — Migration seed'deki 3 Selin senaryosunda `role_context` çok detaylı dolu, ama admin panelden eklenen yeni senaryolarda kullanıcı bu alanı boş bırakabilir. Builder boş gördüğünde persona seans-spesifik durumu öğrenmiyor → kendi backstory'sine geri dönüyor.

**Çözüm yolları (ÖNCELIK SIRASIYLA):**

#### Yol 1 (P3 — Veri Hijyeni) — Dokümantasyon + Form UX
- Senaryo edit form'unda "Persona Rol Bağlamı" alanına **zorunlu olmasa da güçlü bir hint** ekle: "BU ALANI BOŞ BIRAKMA — persona'nın bu seansda hangi spesifik durumu yaşadığını yaz. Boş bırakırsan persona kendi kalıcı backstory'sine geri döner."
- Süper admin onboarding kitabına persona prompt yazma rehberi: "Persona prompt = karakter özellikleri (kalıcı). Senaryo role_context = şu anki durum (geçici). İkisini karıştırma."
- **Süre:** 30 dk (form helper text + onboarding doc)

#### Yol 2 (P2 — Yapısal) — Prompt sıralaması ve uyarı
- `scenarioSection`'ı 7. sıradan **2. sıraya** taşı (persona prompt'undan hemen sonra) → senaryo ağırlığı artar
- Persona prompt'unun başına runtime'da bir uyarı enjekte et: "Senaryo bağlamı seni yönlendirir. Persona'nın kalıcı backstory'sinde başka konular varsa, BU SEANS'da o konuları AÇMA — sadece senaryoda belirtilen duruma odaklan."
- Test: Tüm mevcut 5 persona × 3 senaryo kombinasyonunda davranış kontrolü
- **Risk:** Tüm seansları etkiler — agresif prompt ordering değişikliği. A/B test düşünülebilir.
- **Süre:** ~1-2 gün (kod + kapsamlı manuel test)

#### Yol 3 (Phase 2 mimarisi) — Persona/Scenario sorumluluk ayrımı
- Persona system_prompt = SADECE karakter (kişilik, korkular, iletişim tarzı, tetikleyiciler) — senaryo-agnostic
- Senaryo role_context = ŞU ANKİ durum (yarın sunum var, dün şikayet aldı, 3 ay kontrat süresi var, vb.)
- Mevcut 5 persona'nın system_prompt'unu revize et: senaryo-spesifik dertleri sil, sadece karakter bırak
- 3 senaryo seed'inde role_context zaten doğru şekilde yazılmış — bunlar referans
- **Risk:** Yüksek — mevcut tüm persona seed'leri revize gerek; LLM davranışı tamamen yeniden test edilmeli
- **Süre:** 1-2 gün
- **Önkoşul:** P2-Roleplay-002 (Phase 2) kapsamına alınabilir

**Acceptance:**
- Kullanıcı senaryo seçtiğinde persona O senaryoya özgü durumu konuşur, kalıcı backstory'sine kaymaz
- "İlk Sunum Heyecanı" senaryosunda persona sunum heyecanı konusunu açar, A sınıfı doktor randevu konusunu KESINLIKLE açmaz
- Mevcut 5 persona × N senaryo kombinasyonu manuel test edilir, regression yok

**Önerilen başlangıç:** **Yol 1 (data hygiene + form UX)** — sıfır risk, hızlı kazanç. Yetmezse Yol 2'ye geç. Yol 3 Phase 2 ile birlikte.

**İlişkili:** [P1-Roleplay-001](#) (tamamlandı) — bu fix Phase 1'in temelini açtı; Yol 3 Phase 2 ile entegre olur.

---

### P1-Schema-001 — Migration 046 Production Apply

**Bağlam:** `20260426_046_session_messages_align.sql` staging'de uygulandı; production'a uygulanmamış. AI konuşma geçmişi için kritik.

**Aksiyon:** Production deploy zamanı clean-install migration paketinin parçası olarak çalıştırılır. (Zaten yol_haritasi'nda var ama burada da liste edildi.)

---

## 🟡 P2 — İlk Ay İçinde

### P2-Roleplay-002 — Tam Parametrik Roleplay Mimarisi (Phase 2)

**Belge:** `Post_Launch_Phase_2.md` (ayrı plan, hazır)

**Özet:** Mode preset sistemi, dinamik faz taksonomisi, evaluation target awareness. 4 starter mode preset.

**Önkoşul:** Phase 1 (P1-Roleplay-001) tamamlanmış olmalı.

**Tahmini süre:** ~2 hafta

---

### P2-Voice-002 — Yarım Cümle / Sessizlik UX İyileştirmesi

**Bağlam:** VAD `SILENCE_MS = 700` ile konuşma sonu algılıyor. Kullanıcı düşünürken duraklarsa VAD kapatıp segment'i göndererek yarım cümle oluşturuyor. AI prompt fix yardım ediyor ama UI tarafında daha iyi feedback verilmeli.

**Aksiyon:**
- Mikrofon "konuşmayı duydu, duraklama bekliyor" görsel feedback (ses dalgası anim devam etsin)
- Belki konfigürasyon: kullanıcı kendi silence threshold'unu ayarlayabilir (yavaş konuşanlar için 1500ms)
- "Daha söyleyeceğin var mı?" interactive prompt, AI tarafından rolüne göre

**Tahmini süre:** 1 gün

---

### P2-Audio-001 — iOS Safari Üzerinde Tam Test

**Bağlam:** Phase 1 fix'leri Chrome+Safari (macOS) üzerinde test edildi. iOS Safari'de:
- Autoplay policy daha katı
- AudioContext sample rate farklı olabilir
- Mikrofon izinleri farklı UI

**Aksiyon:**
- Gerçek iPhone/iPad ile uçtan uca test
- Bulunan sorunlar için fix (singleton element zaten var, autoplay unlock zaten var — büyük olasılıkla sadece doğrulama)

**Tahmini süre:** Yarım gün test + olası fix'ler

---

### P2-Whisper-001 — Yarım Cümle Detection ve Reactive UX

**Bağlam:** Test seansında kullanıcı "Şirket olarak bizim kültürümüzde aslında" diyerek yarıda bırakıp düşündü. AI cümleyi tamamlayıp yönlendirdi. Prompt fix yardım eder ama kesin değil.

**Aksiyon:**
- STT yanıtında trailing pattern check (cümle "..., aslında, çünkü, fakat" gibi continuation word ile bitiyorsa half-completion sinyali)
- AI'a metadata olarak "kullanıcı yarım bıraktı muhtemelen" hint geç
- Veya client tarafında STT sonrası "Devam edecek misin?" mikrosaniye buffer
**Tahmini süre:** 1-2 gün

---

### P2-Eval-001 — Evaluation Engine Telemetri

**Bağlam:** Her seans bittiğinde evaluation çalışıyor. Hata veya kötü sonuç durumunda görünürlük yok.
**Aksiyon:**
- Evaluation latency, retry count, error type metric'leri
- Super admin dashboard'da evaluation health widget
- QStash retry pattern audit log

**Tahmini süre:** 1 gün

---

### P2-Debrief-001 — Debrief Pre-Canned Greeting (Latency Sıfırlama)

**Bağlam:** DEBRIEF-LATENCY-001 fix'iyle paralelleştirme uygulandı (~500-700ms tasarruf). Geriye kalan 3-3.5sn açılış gecikmesi chat API + TTS sentezi süresi. Kullanıcı butona basıyor → 3sn sessizlik → AI konuşuyor. Bu hâlâ "boş zaman" hissi veriyor.

**Hedef:** Buton basışı anında ses başlatmak (perceived latency 0).

**Yaklaşım:**
1. **Static pre-canned greeting** — Kullanıcı adı interpolasyonu ile sabit metin: *"Merhaba {firstName}, nasılsınız? Seans değerlendirme analizi hazırlanırken birkaç soru sormak istiyorum."* — bu metnin TTS'i önceden cache'lenebilir veya hızlıca sentezlenebilir.
2. **Background chat call** — Pre-canned çalarken arka planda `sendToDebrief` çağrısı yapılır; AI'ın "ilk gerçek sorusu" hazırlanır.
3. **Sıralı TTS** — Pre-canned bittiğinde AI'ın gerçek sorusu hemen çalmaya başlar.

#### Implementasyon Yaklaşımı (3 alt yol)

**A. Client-side static + background chat** (en basit, ~1 gün)
- Client'a sabit greeting text constant: `DEBRIEF_PRECANNED = "Merhaba {firstName}..."`
- Click → unlock + TTS (sabit text) anında başlar
- Paralelde `sendToDebrief` chat'e ilk gerçek soruyu üretmesi için trigger atar
- Pre-canned bitince gerçek soru sıraya girer
- Trade-off: chat history'de pre-canned mesaj görünmez (yalnızca sesli) — debrief transcript'inden eksik kalır

**B. Pre-cached MP3 (en hızlı, ~0.5 gün ama sınırlı)**
- 5 popüler isim için (Mehmet, Ayşe, Ali, Fatma, Özcan) pre-cached MP3 generation script
- Bilinmeyen isimler için fallback (tam interpolation runtime)
- Trade-off: Storage maintenance, isim çeşitliliği sorunu

**C. Streaming TTS (en zarif, 2-3 gün)**
- ElevenLabs streaming endpoint kullan
- Chat API ilk chunk'ı verince TTS sentezi başlar (paralel)
- TTS audio chunk-by-chunk client'a stream edilir
- Trade-off: Mevcut full-buffer pattern'ı (Safari uyumlu) bozulur, refactor gerekir

**Önerilen:** **A** — sınırlı maliyetle gözle görülür UX iyileşmesi. B opsiyon olarak eklenebilir. C uzun vade.

**Acceptance:**
- Buton basıldıktan sonra 1 saniye içinde ses başlar
- Pre-canned greeting + AI gerçek sorusu kesintisiz akar
- Mic permission paralel resolve olur (mevcut paralelleştirme korunur)
- Chat history en az AI'ın gerçek mesajını içerir

**Tahmini süre:** 1 gün (A yaklaşımı)

---

### P2-Prompt-001 — AI Yanıt Tekrarını Azaltma (Paraphrase Diversity)

**Bağlam:** Test seansında (Neslihan Bozkurt / Tükenmişlik İtirafı, 20 mesaj) AI'ın art arda iki yanıtında aynı kalıbı kullandığı tespit edildi:
- #10 (assistant): *"kendi içimde anlamaya ve hissettiklerimi çözmeye çalışıyorum"*
- #12 (assistant): *"kendi içimde anlamaya ve hissettiklerimi çözmeye çalışıyorum"*

Kullanıcı #13'te bunu yakaladı: *"Sohbetimiz içerisinde birkaç defa aynı cümleyi kurdun."* — gerçek bir kullanıcı için bu rolü kıran bir an.

**Kök neden:** gpt-4o, persona'nın iç sıkışmasını anlatırken aynı dilsel yapıyı tekrar üretiyor. Prompt'ta "kendini tekrarlama" kuralı yok.

**Aksiyon:**
1. `system-prompt.builder.ts` `roleReminder` bölümüne dil çeşitliliği kuralı ekle:
   ```
   ### Dil Çeşitliliği
   - Aynı cümleyi veya yakın paraphrase'leri ardışık yanıtlarda tekrar etme.
   - Karakterin iç dünyasını farklı ifadelerle ortaya koy: bazen kısa cümleler, bazen tereddüt, bazen örnek anı, bazen suskunluk.
   - Eğer aynı duygusal yere geri dönüyorsan, farklı bir açıdan ifade et — kullanıcı zaten önceki cümleni hatırlıyor.
   ```
2. Opsiyonel: chat route'ta son N asistan yanıtının ilk 50 karakterlerini fingerprint olarak hashle, mevcut yanıtla %80+ overlap varsa LLM'i yeniden çağır (defansif). Bu over-engineering olabilir; öncelikle prompt fix dener, ölçer.

**Acceptance:** 20 mesajlık test seansında ardışık 2 asistan yanıtının ilk 30 kelimesi en az 5 kelime farkıyla başlamalı (manual review).

**Tahmini süre:** 30 dk prompt fix + 1 saat test/iterasyon

---

### P2-Persona-001 — Persona Voice ID Bulk Atama

**Bağlam:** PersonaForm'a voice_id alanı eklendi. Süper admin tek tek girmek zorunda. 5+ persona varsa zaman alır.

**Aksiyon:**
- "Voice ID önerisi" feature: persona cinsiyetine/yaşına göre ElevenLabs library'den otomatik öneri
- Veya voice galerisi içinde dropdown (popüler 10-15 voice)

**Tahmini süre:** Yarım gün

---

### P2-Cost-001 — AI Maliyet Takip ve Görselleştirme (Super Admin)

**Bağlam:** Sistemde iki maliyet üreten dış servis var: **OpenAI** (LLM — chat, summarize, evaluation, debrief; STT — Whisper) ve **ElevenLabs** (TTS — persona sesi + debrief koçu + sesli rapor). SaaS olarak super admin için tenant başına kim ne kadar maliyet üretiyor görünürlüğü gerekli — özellikle kâr-zarar analizi, plan-temelli kotalar, abuse tespiti için.

Şu an hiçbir maliyet takibi yok. Faturalar OpenAI/ElevenLabs dashboard'ında izleniyor, ama tenant/kullanıcı kırılımı çıkarılamıyor.

#### Hedeflenen Görünümler

> **UI Spesifikasyonu (2026-05-01 ek netleştirme):** Super admin dashboard'da temel görünüm bir **tenant tablosu** olacak. Her satır tıklanabilir/expandable — açıldığında o kuruma ait kullanıcıların aynı sütun yapısıyla listelendiği sub-table iner.

**Servis kırılımı sütunları (her iki tabloda da):**
| Sütun | Kapsam |
|---|---|
| LLM Harcama | gpt-4o chat + summarize + evaluation + debrief chat (OpenAI) |
| STT Harcama | Whisper-1 (veya gpt-4o-mini-transcribe) — sesli seans + debrief input (OpenAI) |
| TTS Harcama | ElevenLabs — persona sesi + debrief koçu + sesli rapor |
| Toplam | Üç kalemin toplamı |
| Seans Sayısı | Aralıktaki tamamlanan seans (context için) |
| Ort. Seans Maliyeti | Toplam / Seans Sayısı (anomali tespiti) |

> **Not:** Embedding/moderation gibi başka kalemler eklenirse ayrı sütun olarak gösterilir; şimdilik LLM/STT/TTS yeterli.

1. **Super Admin Cost Dashboard (`/admin/costs`) — Tenant tablosu:**
   - Tarih aralığı filtresi (bugün / son 7 gün / son 30 gün / custom range)
   - Para birimi: USD varsayılan; opsiyonel TRY/EUR toggle (FX rate snapshot ile)
   - **Tablo sütunları:** Kurum Adı | LLM | STT | TTS | Toplam | Seans Sayısı | Kullanıcı Sayısı | Ort. Seans Maliyeti
   - Sıralanabilir (varsayılan: Toplam DESC)
   - **Satır expand:** kurum adına tıklandığında **inline sub-table** açılır — o kurumun kullanıcılarını aynı sütunlarla gösterir (Kullanıcı Adı | LLM | STT | TTS | Toplam | Seans Sayısı | Ort. Seans Maliyeti)
   - Sub-table de sıralanabilir; varsayılan Toplam DESC (en pahalı kullanıcı en üstte)
   - Footer: tüm tenant'ların grand total'ı + servis bazlı dağılım pasta grafik
   - Trend grafiği (zaman içinde toplam maliyet eğrisi, üstte ayrı kart)
   - Top 10 maliyetli kullanıcı global widget (cross-tenant, abuse tespiti) — kurumdan bağımsız global liste, ayrı kart

2. **Tenant Detail (`/admin/costs/[tenantId]`) — Drill-down:**
   - Tenant tablosundan satır click → tam sayfa detay (sub-table'a alternatif derin görünüm)
   - Bu tenant'ın seçilen aralıktaki tüm seansları (tablo)
   - Her seansın LLM + STT + TTS kırılımı + toplam
   - Kullanıcı bazlı toplam (sub-table'daki veriyle aynı, bu sayfada genişletilmiş)
   - Persona/scenario bazlı agregasyon (hangi persona daha pahalı — uzun yanıt üretiyor olabilir)
   - CSV export butonu (bu tenant için)

3. **Operational Alarmlar:**
   - Tenant aylık maliyeti X eşiğini geçerse super admin'e email
   - Tek seans 5 USD'yi geçerse warning (anormal kullanım — sonsuz döngü, prompt patolojisi)

#### Gerekli Veri Modeli

**Yeni tablo: `ai_usage_events`**

```sql
CREATE TABLE ai_usage_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  user_id           UUID REFERENCES users(id),         -- NULL: tenant-level/system event
  session_id        UUID REFERENCES sessions(id),       -- NULL: tenant-level (bulk invite vb.)
  service           TEXT NOT NULL CHECK (service IN ('openai', 'elevenlabs')),
  operation         TEXT NOT NULL,                      -- 'chat', 'stt', 'tts', 'summarize', 'evaluate', 'debrief_chat', 'debrief_tts', 'report_audio'
  model             TEXT,                               -- 'gpt-4o', 'whisper-1', 'eleven_turbo_v2_5'
  -- Token / karakter / saniye sayaçları
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cached_tokens     INTEGER,
  audio_seconds     NUMERIC(10,2),                      -- Whisper input
  characters        INTEGER,                            -- ElevenLabs TTS girdi karakter sayısı
  -- Maliyet hesabı
  cost_usd          NUMERIC(10,6) NOT NULL DEFAULT 0,   -- 6 decimal: $0.000005 hassasiyet
  pricing_version   TEXT,                               -- 'openai-2026-04', 'elevenlabs-2026-04' — fiyat değişiminde audit
  -- Hata durumu
  status            TEXT NOT NULL DEFAULT 'success',    -- 'success', 'error', 'retry'
  error_code        TEXT,
  metadata          JSONB                               -- request_id, latency_ms, vs.
);

CREATE INDEX idx_ai_usage_tenant_date ON ai_usage_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_ai_usage_user_date ON ai_usage_events(user_id, occurred_at DESC);
CREATE INDEX idx_ai_usage_session ON ai_usage_events(session_id);
CREATE INDEX idx_ai_usage_service_date ON ai_usage_events(service, occurred_at DESC);
```

**Pricing config** (`src/lib/billing/pricing.ts`):
```ts
export const PRICING = {
  openai: {
    'gpt-4o': { input_per_1m: 2.50, output_per_1m: 10.00, cached_input_per_1m: 1.25 },
    'gpt-4o-mini': { input_per_1m: 0.15, output_per_1m: 0.60 },
    'whisper-1': { audio_per_minute: 0.006 },
    'gpt-4o-mini-transcribe': { audio_per_minute: 0.003 },  // gelecek STT upgrade
  },
  elevenlabs: {
    'eleven_turbo_v2_5': { per_character: 0.0001 },           // doğrulanacak
  },
}
```

Pricing değişimleri için `pricing_version` damgası — geriye dönük raporları bozmaz.

#### Implementasyon Yaklaşımı

1. **Adapter-level instrumentation:**
   - `OpenAILLMAdapter`, `OpenAISTTAdapter`, `ElevenLabsTTSAdapter` her başarılı/başarısız çağrıdan sonra `recordUsageEvent()` helper'ını çağırır
   - Helper context'ten (request scope) `tenantId`, `userId`, `sessionId` okur
   - Pricing config'ten cost hesaplar, async insert eder (fire-and-forget — adapter latency'sini etkilemesin)

2. **Context propagation:**
   - Server action / API route içinde `usageContext = { tenantId, userId, sessionId }` AsyncLocalStorage ile set edilir
   - Adapter'lar bu context'e erişir
   - Test ortamında null-safe (test code instrumentation'ı bypass eder)

3. **Aggregation views:**
   - `mv_tenant_costs_daily` materialized view — günlük tenant başına servis/operation kırılımı
   - Background refresh job (10 dk'da bir) — dashboard query'leri ucuz olur
   - Adhoc query için raw `ai_usage_events` her zaman erişilebilir

4. **UI:**
   - `/admin/costs` Server Component — recharts ile bar/line chart
   - CSV export butonu (super admin için), aylık fatura tahmini

#### Tradeoff'lar

- **+** SaaS sağlık görünürlüğü, kâr-zarar takibi
- **+** Abuse/anomaly tespiti (sonsuz token üreten persona)
- **+** Tenant-bazlı plan / kota mekanizması için temel (ileride P2-Pricing-001)
- **−** Her LLM/TTS çağrısında bir DB insert (~5-10ms async overhead, hot path değil ama sayılır)
- **−** Pricing güncel tutulması manuel (OpenAI/ElevenLabs fiyat değişikliklerinde update gerekir)
- **−** Yeni tablo, migration, materialized view bakımı

#### Acceptance

- [ ] Her seans sonrası `ai_usage_events` doğru `cost_usd` ile dolar
- [ ] Super admin `/admin/costs`'da tenant kırılımı + servis ayrımı + tarih filtresi görür
- [ ] Tenant detay sayfasında kullanıcı/persona kırılımları erişilebilir
- [ ] Pricing config değişikliği geriye dönük raporları bozmaz (`pricing_version` damgası)
- [ ] Materialized view 10 dk içinde güncellenir
- [ ] CSV export çalışır

#### Tahmini Süre

| Görev | Süre |
|---|---|
| Schema migration + pricing constants | 1 gün |
| Adapter instrumentation + AsyncLocalStorage context | 2 gün |
| Materialized view + refresh job | 1 gün |
| `/admin/costs` dashboard UI + chart'lar | 2 gün |
| Tenant detail sayfası | 1 gün |
| Export + alarm e-mailleri | 1 gün |
| Test + dokümantasyon | 1 gün |
| **Toplam** | **~9 iş günü (~2 hafta)** |

> **Not:** Bu özellik aslında P1 değerinde olabilir (SaaS bazlı bir ürün için maliyet körlük büyük risk), ama launch sonrası 1-2 ay içerisinde gerçek kullanım sinyalleri alınınca daha doğru priortize edilir. İlk dönemde manuel OpenAI/ElevenLabs dashboard'larından izleme yeterli.

---

## 🟢 P3 — Fırsat Oldukça

### P3-Lint-001 — ESLint Warning Temizliği

**Bağlam:** ~150 ESLint warning birikmiş. `any` tipleri, set-state-in-effect, unused vars. Pre-existing borç.

**Aksiyon:** Dosya bazlı temizlik, sprint dışı backfill.

**Tahmini süre:** Süresi belirsiz, paralel iş

---

### P3-Voice-003 — Voice Cloning

**Bağlam:** ElevenLabs custom voice ile tenant-spesifik sesler.

**Aksiyon:** Tenant admin kendi seslerini upload edebilsin. Persona'lar bu sesleri seçebilsin.

**Önkoşul:** ElevenLabs Pro plan / voice clone API kontrolü.

---

### P3-Voice-004 — Voice-Only Erişilebilirlik Fallback

**Bağlam:** Mikrofon kullanamayan kullanıcılar (donanım eksikliği, gürültülü ortam) için text-mode geri dönüş seçeneği.

**Aksiyon:** Settings'te "Voice + Text" / "Voice only" toggle. Text mode için minimum UI (ADR-011 ile kaldırılmıştı; opsiyonel olarak geri eklenebilir).

---

### P3-Folder-001 — `AIUON MIRROR` Klasör Adı Rename

**Bağlam:** Üst-dizin adında boşluk var, bazı tool'lar takılıyor.

**Aksiyon:** `aion-mirror` veya `AION_MIRROR`'a rename. Git'te adı değişir, IDE refresh gerekir.

---

### P3-Cron-001 — Orphan Active Session Auto-Cleanup

**Bağlam:** Test sürecinde 9 orphan active seans biriktirdi (sayfa kapatılınca status temizlenmiyor). Manuel script ile temizlendi.

**Aksiyon:** Cron job — `started_at < now() - 4 hours AND status='active'` seansları otomatik `cancelled`'a çek. QStash veya Supabase Edge Functions ile.

**Tahmini süre:** 2-3 saat

---

### P3-Filament-001 — Persona Form UX Geliştirmeleri

**Bağlam:** PersonaForm uzun, kart sıralaması optimize edilebilir.

**Aksiyon:**
- Sticky save button
- Prompt ve sözleşme kartları için "preview" toggle (LLM'e nasıl görüneceği)
- Bölüm anchor link'leri (skip to section)

---

### P3-Worktree-001 — Claude Worktree Temizliği ve Build Çalışırlığı

**Bağlam:** Claude Code her oturumda `.claude/worktrees/<isim>` altında izole bir git worktree açar. Birikmiş worktree'ler diskte yer kaplar ama daha önemlisi: hiçbirinde `node_modules` yok. Bu yüzden worktree dizininde `npm run build` veya `npm run dev` çalıştırılınca Turbopack `next/package.json`'ı çözemiyor, hata veriyor:

```
Error: Next.js inferred your workspace root, but it may not be correct.
We couldn't find the Next.js package (next/package.json) from the project directory:
.../.claude/worktrees/<isim>/src/app
```

**Production etkisi:** SIFIR. Vercel CI fresh checkout + `npm install` yapar, GitHub'a push edilen branch'in worktree mantığı yoktur. Hata sadece **lokal worktree'de manuel build** çalıştırıldığında görünür.

**Mevcut worktree envanteri (2026-04-30):**
```
elastic-ellis-01affa            AKTİF — bu sprint'in commit'leri (caa3dd8)
agitated-kapitsa-bd755e         başka oturum, commit'leri olabilir
zealous-taussig-f8a0cf          başka oturum, commit'leri olabilir
flamboyant-tereshkova-2a81c9    BOŞ — main ile aynı commit (90d6b3a)
goofy-morse-93558a              BOŞ — main ile aynı commit (90d6b3a)
```

**Aksiyon (sırayla):**

1. **Boş worktree'leri sil** (5 dk, sıfır risk):
   ```bash
   git worktree remove .claude/worktrees/flamboyant-tereshkova-2a81c9
   git worktree remove .claude/worktrees/goofy-morse-93558a
   ```

2. **Aktif worktree'lerin durumunu netleştir** (10 dk):
   - `agitated-kapitsa-bd755e` ve `zealous-taussig-f8a0cf`'da hangi branch var, merge edildi mi kontrol et
   - Merge edildiyse worktree + branch'i sil; edilmediyse PR aç veya pas geç

3. **Symlink ile worktree'lerde build aktive et** (opsiyonel, 1 dk):
   ```bash
   for d in .claude/worktrees/*/; do
     [ ! -e "$d/node_modules" ] && ln -s ../../../node_modules "$d/node_modules"
   done
   ```
   Veya `.git/hooks/post-checkout` ile otomatik:
   ```bash
   #!/bin/sh
   [ ! -e node_modules ] && [ -d ../../../node_modules ] && ln -s ../../../node_modules node_modules
   ```

4. **Karar: Claude Code worktree davranışı** (R&D):
   - Worktree akışı çoklu Claude oturumu için faydalı (paralel çalışma + branch izolasyonu)
   - Tek oturum çalışıyorsan ana dizinde direkt çalışmak da mümkün — Claude settings'te kapatılabilir mi araştırılmalı

**Acceptance:**
- Worktree'lerde `npm run build` ve `npm run dev` çalışır hale gelir VEYA
- Worktree akışı kapatılır + ana dizinde çalışılır
- Boş worktree'ler temizlenir (disk + zihinsel yük)

**Tahmini süre:** 30 dk (boş worktree silme + symlink). 2 saat (aktif worktree audit + Claude settings araştırması).

**Risk:** Aktif worktree'lerde merge edilmemiş commit'ler varsa veri kaybı. Önce `git worktree list -v` ile commit hash'leri kontrol et.

---

## 🔵 R&D — Karar Bekleyen

### R&D-001 — OpenAI Realtime API Geçişi

**Bağlam:** STT + LLM + TTS pipeline'ını tek WebRTC bağlantısında birleştirir. Latency 500ms → 100ms. Ama mimari değişim büyük.

**Karar gereken:**
- Cost analizi (Realtime token fiyatı vs. mevcut whisper+gpt+elevenlabs)
- Latency gerçekten kullanıcı için fark yaratıyor mu (kullanıcı feedback gereklı)
- Multi-tenant routing zorlukları

**Önerilen:** Launch sonrası 2-4 hafta canlı veri topla, sonra karar ver.

---

### R&D-002 — Rubric Scoring Calibration

**Bağlam:** ICF rubric LLM ile değerlendiriyor. Scoring tutarlılığı belirsiz (bir koç sürekli 4 alıyorsa real mi yoksa LLM bias mı?).

**Karar gereken:**
- Inter-rater reliability test (aynı transcript için 5 kez değerlendir, varyans ölç)
- İnsan koç ile karşılaştırmalı validation
- Persona/scenario bazlı bias var mı?

**Önerilen:** Launch sonrası 50+ seans birikince statistical analysis.

---

### R&D-003 — Multi-Party Roleplay

**Bağlam:** Şu an 1 kullanıcı + 1 AI. Mülakat paneli, ekip toplantısı gibi senaryolar için 1 kullanıcı + 2-3 AI gerek.

**Karar gereken:**
- Audio routing (her persona ayrı voice mi yoksa adlandırma "Ahmet:", "Mehmet:" mi?)
- Turn-taking algoritması
- Phase 3+ planlaması

---

### R&D-004 — Mode Galerisi (Marketplace)

**Bağlam:** Phase 2'de 4 mode preset kod constant'ı. İleride tenant'lar arasında mode paylaşımı (Marketplace tarzı).

**Karar gereken:** Launch sonrası tenant adoption + custom mode talebi varsa planlanır.

---

### R&D-005 — Tenant-Bazlı Kota / Billing Modeli

**Bağlam:** P2-Cost-001 maliyet **görünürlüğü** sağlar. Bunun üstüne **operasyonel kontrol** katmanı (tenant başına aylık seans/maliyet limiti, plan tier'ları, otomatik faturalama) gerekebilir.

**Karar gereken:**
- Plan modeli: Free / Starter / Pro / Enterprise (her birinde aylık seans limiti, persona sayısı, özellik kısıtı)
- Kota aşımı durumu: hard block mu, soft warning mu, overage charge mu?
- Stripe / Paddle entegrasyonu (tenant başına abonelik)
- Kullanıcı bazlı kota (tenant içindeki kullanıcı seviyesi limiti)
- Trial period mekaniği

**Önerilen:** P2-Cost-001 implementasyonu sonrası 2-3 ay gerçek kullanım verisi topla, plan tier'larını veriye dayalı belirle, sonra kota/billing UI/UX tasarla.

**Önkoşul:** P2-Cost-001 tamamlanmış olmalı (maliyet verisi olmadan plan tier belirlenemez).

---

## Süreç

### Bu Belgenin Yaşam Döngüsü

1. **Launch sonrası ilk hafta:** Liste gözden geçirilir, P1'ler önceliklendirilir. Yeni feedback eklendi varsa sınıflandırılır.
2. **Her tamamlanan iyileştirme:** Bu belgeden taşınır → ilgili kalıcı belgeye (CLAUDE.md "Tamamlananlar", yol_haritasi vb.)
3. **Aylık review:** Boş kalanlar reprioritize, iptaller işaretlenir.

### Yeni İyileştirme Önerisi Eklerken

Format: `### [Kategori-Konu-NN] — [Başlık]`

İçerik:
- **Bağlam:** Niye gerekli, hangi sinyal var?
- **Aksiyon:** Spesifik ne yapılacak?
- **Tahmini süre:** Saat veya gün cinsinden gerçekçi
- **Acceptance** (varsa): Neyle "tamam" sayılır?
- **Önkoşul** (varsa): Hangi başka iş bunun önünde?

---

## İlgili Belgeler

- [`Pre_Launch_Phase_1.md`](Pre_Launch_Phase_1.md) — Phase 1 detaylı plan
- [`Post_Launch_Phase_2.md`](Post_Launch_Phase_2.md) — Phase 2 detaylı plan
- [`canli_yayina_cikis_plani_20260425.md`](canli_yayina_cikis_plani_20260425.md) — Aktif sprint planı
- [`yol_haritasi_20260424.md`](yol_haritasi_20260424.md) — Genel roadmap
- [`mimari_kararlar_20260423.md`](mimari_kararlar_20260423.md) — ADR'ler
