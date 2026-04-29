# Seans Raporu — Yeni Mimari Taslak

> **Amaç:** Mevcut "ortalama puan + güçlü/gelişim listeleri" tarzı rapordan,
> referans projenin (rising_performance) sergilediği **hiyerarşik + aksiyon
> odaklı** rapora geçmek. Her rubric boyutu için **transcript kesiti + DO/DON'T**
> ipuçları zorunlu.
>
> **Durum:** Onay bekliyor — kod değişikliği YOK. Sen bakacaksın, tartışacağız.

---

## 1. Hedeflenen Değer Önerisi

| Stakeholder | Mevcut Rapor | Yeni Rapor |
|---|---|---|
| Yönetici (kullanıcı) | "2.6 puan, 3 güçlü, 2 gelişim" — soyut | "Bu cümlede X yaptın, bir sonraki seansda Y yap" — somut |
| Şirket (HR/lider) | Bireysel skor karması | Pillar bazlı agregasyon → kohort heatmap, kültür sinyali |
| Koçluk programı | Yetkinlik haritası yok | ICF 8 boyutu → 4 pillar yapılandırması ile takip |

---

## 2. Bilgi Mimarisi — 5 Katman

```
┌───────────────────────────────────────────────────────────────┐
│ KATMAN 1: HERO SCORECARD     (toplam skor + statü + narrative)│
├───────────────────────────────────────────────────────────────┤
│ KATMAN 2: PILLAR MINI-KARTLARI         (4 pillar rollup)       │
├───────────────────────────────────────────────────────────────┤
│ KATMAN 3: PILLAR DETAY PANELLERI                              │
│           (her pillar → 2 boyut → kanıt + DO/DON'T)           │
├───────────────────────────────────────────────────────────────┤
│ KATMAN 4: AKSIYON PANELI       (4-quadrant: güçlü/gelişim/    │
│                                  bir sonraki odak/checklist)  │
├───────────────────────────────────────────────────────────────┤
│ KATMAN 5: YANSIMA ŞERIDI       (manager insight, seans anı)    │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. ASCII Tasarım Taslağı

### Üst bar (sticky)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  ←  Seans Raporu                          Selin Çelik · İlk Sunum Stresi          │
│     30 Nisan · 18 dk 42 sn                          [📥 PDF İndir] [▶ Yeni Seans] │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

### KATMAN 1 — Hero Scorecard

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    │              28 / 40                    │
                    │                                         │
                    │           Gelişen Liderlik Profili      │
                    │      ████████████████░░░░░░░░░  70%     │
                    │                                         │
                    │  Selin Çelik ile yaptığın koçluk        │
                    │  görüşmesinde aktif dinleme ve güven    │
                    │  ortamı kurma alanlarında güçlüsün.     │
                    │  Sorgulama ve eylem netleştirme         │
                    │  konularında pratik ihtiyacın var.      │
                    │                                         │
                    └─────────────────────────────────────────┘
```

**Statü etiketleri (renk + eşik):**
- `0–14 (≤35%)`     🔴 **Yeniden Yapılandırma Gerektirir**
- `15–23 (38–58%)`  🟠 **Temel Gelişim Aşamasında**
- `24–31 (60–78%)`  🟡 **Gelişen Liderlik Profili**
- `32–36 (80–90%)`  🟢 **Sağlam Koçluk Becerisi**
- `37–40 (≥93%)`    🟣 **Üst Düzey Koçluk Ustalığı**

---

### KATMAN 2 — Pillar Mini-Kartları (4 pillar)

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ A · ÇERÇEVE      │  │ B · VARLIK       │  │ C · SORGULAMA    │  │ D · BÜYÜME       │
│   & ETİK         │  │   & GÜVEN        │  │                  │  │                  │
│                  │  │                  │  │                  │  │                  │
│      6 / 10      │  │      11 / 15     │  │      7 / 10      │  │      4 / 5       │
│  ████████░░░░    │  │  ███████████░    │  │  ███████░░░      │  │  ████████░       │
│                  │  │                  │  │                  │  │                  │
│  Gelişen 60%     │  │  Sağlam   73%    │  │  Gelişen 70%     │  │  Sağlam   80%    │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

**ICF 8 boyutu → 4 pillar gruplaması:**

| Pillar | Boyutlar | Maks Skor |
|---|---|---|
| **A · Çerçeve & Etik** | A1 `ethical_practice`, A2 `establishes_agreements` | 10 |
| **B · Varlık & Güven** | B1 `coaching_mindset`, B2 `cultivates_trust`, B3 `maintains_presence` | 15 |
| **C · Sorgulama** | C1 `listens_actively`, C2 `evokes_awareness` | 10 |
| **D · Büyüme** | D1 `facilitates_growth` | 5 |
| **TOPLAM** | 8 boyut | **40** |

> **Karar gerekli:** Custom rubric'lerde (tenant farklı boyut seçtiyse) gruplama
> nasıl olacak? Önerim: rubric_template tanımına `pillar_code` kolonu eklemek
> → admin tenant rubric'i kurarken her boyutu pillar'a atar. Default ICF
> rubric'i 4 pillar'a hazır gelir.

---

### KATMAN 3 — Pillar Detay Paneli (her pillar bir kart, AÇILABİLİR)

Bu en kritik bölüm. Senin şartını burada karşılıyoruz: **her boyut → kanıt + DO + DON'T**.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  A · ÇERÇEVE & ETİK                                                  6 / 10  ▼    │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  A1 · Etik Uygulamaları Sergiler                                  3 / 5     │ │
│  │  ─────────────────────────────────────────────────────────────────────────  │ │
│  │                                                                             │ │
│  │  📋 Kanıt (Transcript'ten)                                                  │ │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │ │
│  │  │ Sen: "Bu konuyu çevrendekilerle paylaşmak isteyip istemediğine        │ │ │
│  │  │       sen karar veriyorsun, ben sadece dinlemek için buradayım."      │ │ │
│  │  └───────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                             │ │
│  │  ✅ DOĞRU YAPTIĞIN                                                         │ │
│  │  • Danışanın özerkliğine saygıyı net bir cümleyle ortaya koydun.          │ │
│  │  • Rolünü ("dinlemek için buradayım") açıkça çerçeveledin.                │ │
│  │                                                                             │ │
│  │  ⚠️ BUNDAN KAÇIN                                                           │ │
│  │  • Sınır cümlesini sadece bir kez kurdun; konu zorlaştığında tavsiye      │ │
│  │    moduna geçme eğilimi gösterdin (12. dakika).                           │ │
│  │  • "Senin yerinde olsam..." gibi başlayan cümleleri kullanmaktan kaçın.   │ │
│  │                                                                             │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  A2 · Anlaşmaları Kurar ve Sürdürür                              3 / 5     │ │
│  │  ─────────────────────────────────────────────────────────────────────────  │ │
│  │                                                                             │ │
│  │  📋 Kanıt                                                                   │ │
│  │  ┌───────────────────────────────────────────────────────────────────────┐ │ │
│  │  │ Sen:    "Bu seansda neye ulaşmak istersin?"                            │ │ │
│  │  │ Selin:  "Sunum stresimi azaltmayı."                                    │ │ │
│  │  │ Sen:    "Anladım, devam edelim."  ← başarı kriteri sorulmadı           │ │ │
│  │  └───────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                             │ │
│  │  ✅ DOĞRU YAPTIĞIN                                                         │ │
│  │  • Seans amacını açık uçlu bir soruyla başlattın.                          │ │
│  │                                                                             │ │
│  │  ⚠️ BUNDAN KAÇIN                                                           │ │
│  │  • "Neye ulaşırsan başarılı sayarsın?" diye somut başarı kriteri sormadın. │ │
│  │  • Hedefi ölçülebilir hale getirmeden ilerlemen, seans sonu                │ │
│  │    netliğini zayıflattı.                                                   │ │
│  │                                                                             │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

> **Karar gerekli:** Pillar detay default açık mı kapalı mı?
> Önerim: A pillar'ı default açık, diğerleri kapalı (kullanıcı drill-down).

---

### KATMAN 4 — Aksiyon Paneli (4-quadrant)

```
┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐
│  🟢 GÜÇLÜ ALANLAR                     │  │  🟠 GELİŞİM ALANLARI                  │
│  ─────────────────────────────────    │  │  ─────────────────────────────────    │
│  ✓ Aktif dinleme ve yansıtma          │  │  → SMART hedef ve başarı kriteri      │
│    (C1 puanı 4/5)                     │  │    netleştirme (D1 1/5)               │
│  ✓ Güven ortamı kurma                 │  │  → Açık uçlu soru oranını artırma     │
│    (B2 puanı 5/5)                     │  │    (C2 1/5)                           │
│  ✓ Yargısız ve kabullenici dil        │  │  → Sessizliği koçluk aleti olarak     │
│    (B3 puanı 4/5)                     │  │    kullanma (B3 2/5)                  │
└───────────────────────────────────────┘  └───────────────────────────────────────┘

┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐
│  🔵 BİR SONRAKİ ODAK (TEK ŞEY)        │  │  📋 OTURUM KONTROL LİSTESİ            │
│  ─────────────────────────────────    │  │  ─────────────────────────────────    │
│                                       │  │                                       │
│  Bir sonraki seansa açık uçlu         │  │  ✅ Çerçeve / sözleşme kuruldu        │
│  sorularla başla; "evet/hayır"        │  │  ❌ SMART hedef belirlendi            │
│  cevaplı sorulardan kaçın.            │  │  ✅ Aktif dinleme yapıldı             │
│                                       │  │  ❌ Sessizlik kullanıldı              │
│  ↳ Neden: C2'de en düşük puanı       │  │  ✅ Güven ortamı oluştu               │
│    aldın; bu boyut farkındalık        │  │  ❌ Eylem planı oluştu                │
│    yaratmanın temeli.                 │  │                                       │
│                                       │  │  3 / 6 maddenin uyumu sağlandı        │
└───────────────────────────────────────┘  └───────────────────────────────────────┘
```

> **Karar gerekli:** Kontrol listesi 6 madde sabit mi, yoksa rubric'in
> `is_required=true` boyutlarına bağlı dinamik mi? Önerim: **dinamik** —
> rubric tanımı çerçeveler, böylece custom rubric kullanan tenant'lar
> da kendi listelerini görür.

---

### KATMAN 5 — Yansıma Şeridi (alt çerçeve)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│   💡 LİDERLİK İÇGÖRÜSÜ                                                             │
│   "Sen, danışanın hassas noktalara yaklaşırken sezgiyle alan tanıyabilen          │
│    nadir yöneticilerden birisin — bu mevcut güçlü yanını koruyup pekiştir."       │
│                                                                                    │
│   📌 SEANS ANI                                                                     │
│   "8. dakikada Selin'in ağladığı an. Sözünü kesmedin, 4 saniye sessizlik          │
│    bıraktın. O an seansın dönüm noktasıydı."                                       │
│                                                                                    │
│   📈 TREND (5+ seans sonrası açılır)                                              │
│   Sorgulama:        +1.2 ↑   |   Çerçeve & Etik:  -0.4 ↓                          │
│   Varlık & Güven:   +0.8 ↑   |   Büyüme:          stabil                          │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Yan Konular — Aynı Sprint İçinde Çözülecek

### A. Seanslarım Sayfası — "Raporu Görüntüle" linki YOK

**Bulgu:** `src/components/sessions/SessionList.tsx:167` aksiyon kolonunda
sadece `status === 'completed'` ise rapor linki gösteriyor. Yeni debrief
akışında seans `debrief_completed` durumunda bitiyor → link görünmüyor.

**Fix önerisi (basit):**
```ts
// Önceki
{session.status === 'completed' ? <Link>Rapor</Link> : ...}

// Yeni
{['completed', 'debrief_completed', 'evaluation_failed'].includes(session.status)
  ? <Link>Rapor</Link>
  : ...}
```

İkon olarak `FileTextIcon` zaten kullanılıyor — sadece koşul genişleyecek.

---

### B. Başarılarım Sayfası BOŞ

**Üç olası kök neden, biri kesin doğru:**

1. **`gamification_profiles` row'u hiç oluşmamış** (en olası)
   - `awardXPAndBadges` (gamification.service.ts:84) profile yoksa sessizce
     `return { xpEarned: 0 }` diyor — XP yazılmıyor, badge kontrol edilmiyor.
   - Çözüm: Yeni kullanıcı oluşturulurken trigger ile profile insert,
     VEYA evaluation flow'unda profile yoksa upsert.

2. **`badges` tablosu boş** — badge tanımları seed edilmemiş olabilir.
   - `getUserBadges` `user_badges → badges` join yapıyor; badges boşsa
     sonuçlar geliyor ama join boş. Migration'larda badges seed var mı
     kontrol etmek lazım.

3. **RLS policy** — `gamification_profiles` RLS yoksa yine de gözükmez.

**Aksiyon önerisi:** Önce bir sonraki seansda `awardXPAndBadges` log'ları
aç (Vercel logs), gamification_profile var mı kontrol et. Sonra eksik
parça için (trigger / seed / RLS) ayrı küçük migration.

> Bu mockup onaylandıktan SONRA, başarılarım fix'i için ayrı küçük bir
> commit atalım.

---

## 5. Veri Modeli Etkisi

Yeni rapor için gereken DB değişiklikleri:

### A. `rubric_dimensions` tablosuna kolon eklenmeli
```sql
ALTER TABLE rubric_dimensions
  ADD COLUMN IF NOT EXISTS pillar_code TEXT;       -- 'A', 'B', 'C', 'D'

-- ICF rubric için backfill
UPDATE rubric_dimensions SET pillar_code='A'
  WHERE dimension_code IN ('ethical_practice', 'establishes_agreements');
UPDATE rubric_dimensions SET pillar_code='B'
  WHERE dimension_code IN ('coaching_mindset', 'cultivates_trust', 'maintains_presence');
UPDATE rubric_dimensions SET pillar_code='C'
  WHERE dimension_code IN ('listens_actively', 'evokes_awareness');
UPDATE rubric_dimensions SET pillar_code='D'
  WHERE dimension_code IN ('facilitates_growth');
```

### B. `dimension_scores` zaten yeterli
Mevcut `evidence_quotes`, `improvement_tip`, `rationale` kolonları yeterli.
Yeni alan eklemeye gerek YOK; sadece **prompt** bunları doğru doldurmalı.

### C. `evaluations` tablosuna ek (opsiyonel)
Total skor, status_label, next_focus, checklist gibi türev alanları
DB'ye yazmak istersen ek kolonlar; ya da render time'da hesaplarız.
Önerim: **render time** — esnek, migration azaltır.

---

## 6. LLM Prompt'u Tetikleyecek Schema

LLM'den dönmesi gereken JSON şeması (öneri):

```json
{
  "overall": {
    "total_score": 28,
    "max_score": 40,
    "status_label": "Gelişen Liderlik Profili",
    "narrative": "3-4 cümle yöneticiye doğrudan hitap..."
  },
  "pillars": [
    {
      "code": "A",
      "name": "Çerçeve & Etik",
      "score": 6,
      "max": 10,
      "dimensions": [
        {
          "code": "A1",
          "dimension_code": "ethical_practice",
          "score": 3,
          "evidence_quote": "Bu konuyu çevrendekilerle paylaşmak isteyip...",
          "do_well": [
            "Danışanın özerkliğine saygıyı net cümleyle ortaya koydun.",
            "Rolünü açıkça çerçeveledin."
          ],
          "avoid": [
            "Sınır cümlesini sadece bir kez kurdun, sonra tavsiye moduna geçtin.",
            "'Senin yerinde olsam...' başlayan cümleleri kullanmaktan kaçın."
          ]
        }
      ]
    }
  ],
  "actions": {
    "strengths": ["Aktif dinleme ve yansıtma", "..."],
    "development_areas": ["SMART hedef netleştirme", "..."],
    "next_focus": {
      "action": "Bir sonraki seansa açık uçlu sorularla başla.",
      "rationale": "C2'de en düşük puanı aldın; bu boyut farkındalık temeli."
    },
    "checklist": [
      { "label": "Çerçeve / sözleşme kuruldu", "passed": true },
      { "label": "SMART hedef belirlendi", "passed": false }
    ]
  },
  "reflection": {
    "manager_insight": "Sen, danışanın hassas noktalarına...",
    "session_moment": "8. dakikada Selin'in ağladığı an..."
  }
}
```

> **Önemli kural:** Prompt'a **"her boyut için evidence_quote ZORUNLU,
> en az 1 do_well ve en az 1 avoid maddesi ZORUNLU"** koyacağız. Boş
> bırakırsa "Boyut atlandı" hatası fırlatacak.

---

## 7. Karar Listesi (sen onayla)

### A. Yapı kararları
- [ ] **4 pillar** gruplaması ICF için OK mi? (alternatif: 3 pillar veya 5 pillar)
- [ ] **Toplam skor /40** mi, **/100** mü? (öneri: /40)
- [ ] **5 seviyeli statü** (Yeniden Yapı / Temel / Gelişen / Sağlam / Üstün) OK mi?
- [ ] **Pillar detay default kapalı** (A açık) mi, **hepsi açık** mı?

### B. İçerik kararları
- [ ] Her boyutun **evidence_quote'u zorunlu** olsun mu?
- [ ] DO ve DON'T DO **min 1 madde zorunlu** mu? Max kaç madde?
- [ ] **Bir Sonraki Odak** tek cümle mi, cümle + 1 satır gerekçe mi? (öneri: 2.)
- [ ] **Kontrol listesi** 6 sabit madde mi, rubric `is_required` boyutları mı? (öneri: dinamik)

### C. Yan konular
- [ ] **Seanslarım sayfasında** rapor linki fix'i bu sprint'te mi?
- [ ] **Başarılarım** boş — önce diagnose mi yoksa fix mi başlasın?
- [ ] **Migration: rubric_dimensions.pillar_code** eklensin mi?

### D. Faz planı (önerim)
- **Faz 1 (1-2 gün):** Schema migration (pillar_code) + LLM prompt yeniden yazımı + JSON contract
- **Faz 2 (1 gün):** Rapor sayfası yeniden render — 5 katmanlı yapı
- **Faz 3 (yarım gün):** Seanslarım rapor linki fix + Başarılarım diagnose
- **Faz 4 (post-launch):** Trend rozeti + cohort heatmap + PDF export

---

## 8. Onay Akışı

1. Bu MD'yi oku.
2. Karar listesi (madde 7) için bana yanıt ver:
   - "A: 4 pillar OK, /40 OK, statü 5'i 4 yapsın..."
   - "B: evidence zorunlu evet, do/don't 1-3 madde..."
   - "C: rapor linki bu sprint, başarılarım önce diagnose..."
   - "D: faz planı OK / şu farklı..."
3. Onay sonrası kod yazımına başlanacak.

---

_Hazırlayan: Claude · 2026-04-29 akşam_
_Konum: `docs/RAPOR_REDESIGN_TASLAK.md`_
