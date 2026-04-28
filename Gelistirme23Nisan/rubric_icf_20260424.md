# AION Mirror — ICF Koçluk Rubric Tanımları (2026-04-24)

Bu belge, AION Mirror roleplay platformunda **kullanıcının koçluk becerilerini** değerlendirmek için kullanılan **ICF (International Coaching Federation) Core Competencies 2019** çerçevesinin Türkçe rubric tanımlarını içerir.

## Kullanım Bağlamı

- **Kim değerlendirilir?** Seansı yürüten **kullanıcı** (koç rolündeki çalışan).
- **Kim değerlendirir?** GPT tabanlı AI evaluator, seans sonunda seans transcript'i üzerinden analiz yapar.
- **Çıktı:** Her boyut için 1-5 arası puan + kanıt (evidence quote'ları) + kısa feedback.

## Şablon Yapısı

- **ICF Standard Template (tenant_id = NULL, is_locked = true):** İçerik değiştirilemez, sadece aktif/pasif edilebilir.
- **Custom Tenant Template (tenant_id = tenant.id, is_locked = false):** Tenant admin içeriği düzenleyebilir, boyut ekleyip çıkarabilir.

## 8 Temel Boyut

### 1. `ethical_practice` — Etik Uygulamaları Sergiler

**Açıklama:** Koçluk etik kurallarına bağlılık gösterir, mesleki sınırları korur, gizliliği gözetir ve rollerini net olarak tanımlar.

**Puan Kriterleri:**

| Puan | Kriter |
|---|---|
| **1 — Yetersiz** | Mesleki sınırları ihlal eder (danışanlık/terapi/danışman rolüne kayar), kişisel yargılarını dayatır, gizliliği zedeleyecek talepler yapar. |
| **2 — Gelişmekte** | Sınırları zaman zaman koruyamaz, koçluk dışı roller ile karışıklık yaratır (ör: doğrudan tavsiye verir), etik hassasiyet yüzeyseldir. |
| **3 — Yeterli** | Genel olarak koçluk sınırları içinde kalır, gizlilik ve saygı çerçevesini korur, tavsiye yerine soru tercih eder. Kritik anlarda bazen kaymalar olabilir. |
| **4 — İyi** | Etik duruş tutarlı, danışanın özerkliğine saygı belirgin, gizlilik ve saygı net. Karmaşık durumlarda yargısız kalmayı başarır. |
| **5 — Mükemmel** | Etik hassasiyet seansın her anına nüfuz eder, sınırlar proaktif korunur, zorlu etik ikilemlerde (örn: danışanın özerkliği ile yönetim beklentileri çatışınca) net duruş sergiler. |

**Kanıt türleri:** Tavsiye verme/vermeme, yargılayıcı dil, rol netliği, gizlilik referansı.

---

### 2. `coaching_mindset` — Koçluk Zihniyetini Somutlaştırır

**Açıklama:** Açık, meraklı, esnek ve danışan-merkezli bir zihniyet sergiler; kendi önyargılarını yönetir, sürekli öğrenme ve gelişmeye açıktır.

**Puan Kriterleri:**

| Puan | Kriter |
|---|---|
| **1 — Yetersiz** | Yargılayıcı, direktif veya savunmacıdır; kendi çözümünü dayatır, danışanın potansiyeline güvenmez. |
| **2 — Gelişmekte** | Zaman zaman danışan-merkezli olmaya çalışır ama kendi agenda'sına geri döner. Merak yüzeyseldir ("Ne yaptın?" gibi kapalı sorgu). |
| **3 — Yeterli** | Genel olarak açık ve meraklıdır. Danışanın gündemine odaklanır. Önyargılarını fark eder ama her zaman yönetemez. |
| **4 — İyi** | Danışan-merkezli duruş tutarlıdır. Önyargıları fark edip yeniden çerçeveleyebilir. Merak samimi ve derinleştiricidir. |
| **5 — Mükemmel** | Kendisini danışanın hizmetine sunan bir zihniyeti içselleştirmiştir. Açık uçluluk, esneklik ve derin merak seansın dokusunu oluşturur. Kendi varsayımlarını açıkça sorgular. |

**Kanıt türleri:** Kim gündemi belirliyor (koç mu danışan mı), koçun sorularındaki merak kalitesi, kendi varsayımlarını yönetme.

---

### 3. `establishes_agreements` — Anlaşmaları Kurar ve Sürdürür

**Açıklama:** Seansın amacını, başarı kriterlerini ve ölçülebilir çıktısını danışanla birlikte netleştirir; gerektiğinde bunları günceller.

**Puan Kriterleri:**

| Puan | Kriter |
|---|---|
| **1 — Yetersiz** | Seans amacı hiç tanımlanmaz ya da koç tarafından tek taraflı belirlenir. Başarı kriteri yoktur. |
| **2 — Gelişmekte** | Amacı sorar ama yüzeysel kalır ("Bugün ne konuşmak istersin?" → derinleştirmez). Ölçülebilir bir çıktı yoktur. |
| **3 — Yeterli** | Seansın amacını netleştirir, danışandan onay alır. Başarı kriteri belirsiz kalabilir. |
| **4 — İyi** | Amaç + başarı kriteri + somut çıktı birlikte kurgulanır. Seans içinde odak değişince anlaşmayı günceller. |
| **5 — Mükemmel** | "Bugün seanstan çıkarken nasıl hissetmek/ne yapmak istersin?" gibi güçlü anlaşma soruları sorulur. Danışanın gerçek ihtiyacı ile ilan ettiği konu arasındaki farkı fark eder ve yeniden anlaşır. |

**Kanıt türleri:** Seansın açılışında odak netleştirme, başarı kriteri cümlesi, mid-session "hâlâ doğru yerde miyiz?" kontrolü.

---

### 4. `cultivates_trust` — Güven ve Güvenlik Duygusunu Geliştirir

**Açıklama:** Saygı, empati, kabul ve doğrulukla psikolojik güvenli bir alan yaratır.

**Puan Kriterleri:**

| Puan | Kriter |
|---|---|
| **1 — Yetersiz** | Danışanı rahatsız eden yargılayıcı/ithamkar dil, alay, küçümseme. Empati belirtisi yok. |
| **2 — Gelişmekte** | Yüzeysel nezaket var, ama duygulara yer vermiyor. Danışanın savunmaya geçtiği anlar fark edilmiyor. |
| **3 — Yeterli** | Saygılı ve kabullenici tutum belirgin. Duygulara atıfta bulunur. Danışan rahat hissedecek bir zemin mevcut. |
| **4 — İyi** | Empati belirgin ve ifade edilir ("Bunun zor olduğunu anlıyorum"). Kırılgan anlara alan tutar. Sessizliğe izin verir. |
| **5 — Mükemmel** | Danışanın en kırılgan yanlarını açmasına olanak tanıyan bir bağ kurar. Güven belirtisi: danışan kendini sansürlemeden konuşur. Koç paralel dürüstlükte kalır — güzel söylemek için gerçeği atlamaz. |

**Kanıt türleri:** Duygulara verilen yanıtlar, kırılganlık karşısındaki tepkiler, sessizlik ve alan verme, yargısız dil.

---

### 5. `maintains_presence` — Tam Anlamıyla Hazır Bulunur

**Açıklama:** Anda kalır, dikkatini tamamen danışana verir, farkındalıkla tepki gösterir, bilinmezlikle rahat eder.

**Puan Kriterleri:**

| Puan | Kriter |
|---|---|
| **1 — Yetersiz** | Önceden hazırlanmış şablon soruları sıralar, danışanın söylediği şeye tepki vermez, konu atlar. |
| **2 — Gelişmekte** | Zaman zaman dinler ama dikkatini hızlı kaybeder. Sık konu değişimi. |
| **3 — Yeterli** | Dikkati çoğunlukla danışanda. Son söylenene yanıt verir. Kendi kaygısı fark edilir. |
| **4 — İyi** | Mevcudiyet hissedilir. Duygular, enerji değişimi, ses tonu fark edilir ve dile getirilir. Bilinmezliğe tolerans var. |
| **5 — Mükemmel** | Tam anlamıyla hazır — koç "yanıtı bulmak" değil, danışanla birlikte "keşif" modunda. Sessizlik verimli kullanılır. Duygu, beden dili, dil seçimi içsel olarak eşzamanlı okunur. |

**Kanıt türleri:** Sessizlik kullanımı, danışanın duygu/enerji değişimini dile getirme, şablondan sapma esnekliği.

---

### 6. `listens_actively` — Etkin Dinler

**Açıklama:** Danışanın söylediklerini, söylemediklerini ve bunların arkasındaki anlamı derinlemesine dinler; özetler, yansıtır, kontrol eder.

**Puan Kriterleri:**

| Puan | Kriter |
|---|---|
| **1 — Yetersiz** | Danışanın söylediğinin üzerine atlar, kendi düşüncesini anlatır. Yanlış anlamalar fark edilmez. |
| **2 — Gelişmekte** | Yüzeysel dinler — kelimeleri duyar ama anlam katmanını kaçırır. Yansıtma zayıf. |
| **3 — Yeterli** | Temel özetleme + yansıtma yapar. Anlamadığında sorar. |
| **4 — İyi** | Söylenmeyeni de duyar (duraklamalar, ton, çelişkiler). Yansıtmalar derin ve değerlidir. "Az önce şunu söyledin, bu sana ne hissettiriyor?" düzeyinde. |
| **5 — Mükemmel** | Meta-dinleme: söylenen, söylenmeyen, ima edilen, çelişen tüm katmanlar yakalanır. Yansıtmalar danışana yeni bir perspektif kazandırır. Dinleme bir araç değil, seansın dokusu. |

**Kanıt türleri:** Özetleme kalitesi, yansıtma derinliği, çelişkileri dile getirme, duygu/duygusal alt metni duyma.

---

### 7. `evokes_awareness` — Farkındalığı Uyandırır

**Açıklama:** Güçlü sorular, yansıtmalar, paylaşımlar ve gözlemlerle danışanın kendi farkındalığını, içgörüsünü ve yeni bakış açılarını keşfetmesini sağlar.

**Puan Kriterleri:**

| Puan | Kriter |
|---|---|
| **1 — Yetersiz** | Kapalı sorular, tavsiyeler, doğrudan çözüm önerileri. Danışanın kendi keşfine alan yok. |
| **2 — Gelişmekte** | Açık uçlu sorular var ama çoğu "ne" ve "nasıl" ile sınırlı. Varsayımlar sorgulanmaz. |
| **3 — Yeterli** | Açık uçlu, anlamlı sorular sorar. Varsayımları zaman zaman sorgular. Bazı "aha" anları oluşabilir. |
| **4 — İyi** | Güçlü sorular — danışanın bakış açısını değiştiren. Metafor, yeniden çerçeveleme kullanır. İçgörü üretilen anlar belirgin. |
| **5 — Mükemmel** | Sorular danışanı durdurup düşündürür. "Bu bakış açısı sana ne söylüyor?", "Bu hikayenin bu yönünü şimdiye kadar neden anlatmadın?" gibi transformatif sorular. Farkındalık seans boyunca katmanlı gelişir. |

**Kanıt türleri:** Açık uçlu soru oranı (vs. kapalı soru), varsayım sorgulama, yeniden çerçeveleme, "aha" anları.

---

### 8. `facilitates_growth` — Danışanın Gelişimini Kolaylaştırır

**Açıklama:** Farkındalığı eyleme dönüştürür; danışanın özerkliğini destekleyerek somut adımlar, taahhüt ve ilerleme yolları oluşturur.

**Puan Kriterleri:**

| Puan | Kriter |
|---|---|
| **1 — Yetersiz** | Aksiyon adımı yok veya tamamen koç tarafından empoze edilir. Danışan sorumluluğu yoktur. |
| **2 — Gelişmekte** | "Ne yapacaksın?" sorulur ama derinleştirilmez. Adımlar belirsiz, takip yolu tanımlanmaz. |
| **3 — Yeterli** | Danışan somut bir sonraki adım belirler. Zaman çerçevesi/ölçüt zayıf kalabilir. |
| **4 — İyi** | Aksiyon adımları SMART'a yakın (spesifik, ölçülebilir, zamana bağlı). Olası engeller konuşulur. Danışan adımın sahipliğini alır. |
| **5 — Mükemmel** | Adımlar danışanın içsel motivasyonundan doğar. Engeller önceden düşünülür, destek kaynakları belirlenir. Öğrenme yolu, değer-eylem bağlantısı net. Seans sonunda danışanın enerjisi yüksek ve yönü berrak. |

**Kanıt türleri:** Aksiyon adımı somutluğu, zaman/ölçüt tanımı, engel analizi, danışanın taahhüt ifadesi.

---

## Evaluation JSON Çıktı Şeması

AI evaluator her seans için aşağıdaki JSON'u üretir:

```json
{
  "dimensions": [
    {
      "dimension_code": "listens_actively",
      "score": 4,
      "evidence": [
        "Koç 'az önce sinirlenmiş gibiydin, nedir orada yaşanan?' diyerek duygu alt metnini dile getirdi.",
        "Danışanın 3 dk'daki çelişkisini (hedef ile korku) 12. dk'da yansıttı."
      ],
      "feedback": "Dinleme derinliğin güçlü; özellikle duygusal alt metne iniyorsun. 5 seviyesine çıkmak için çelişkileri daha erken yansıtabilirsin."
    }
  ],
  "overall_score": 3.8,
  "strengths": [
    "Güven alanı yaratma becerisi çok iyi — danışan kırılgan yerlere inmekten çekinmedi.",
    "Yansıtmaların derin, metafor kullanımın etkili."
  ],
  "development_areas": [
    "Seans açılışında anlaşma kurma daha netleşmeli — 'bugün çıkarken ne farklı olsun?' gibi bir soru eksikti.",
    "Aksiyon adımı somutlaşmadı; SMART çerçevesi ile kapatmak etki yaratır."
  ],
  "coaching_note": "Bu seansta kullanıcı güçlü bir empati ve dinleme sergiledi. Danışan 12. dakikada ilk kez 'korku' kelimesini kullandığında koç bunu iyi yakaladı. Gelişim alanı olarak seans kapanışında somut taahhüt alma tekniği çalışılabilir.",
  "manager_insight": "Koç adayının güçlü yönü: mevcudiyet ve dinleme. Gelişim önceliği: anlaşma kurma + aksiyon sözleşmesi. Önerilen uygulama: her seansın ilk 3 dakikasında SMART hedef netleştirme çalışması."
}
```

## 2-4 Ek Custom Rubric Önerileri (Tenant Bazlı)

ICF standart rubric'e ek olarak tenantların ihtiyaçlarına göre etkinleştirebileceği 4 ek rubric:

### A. `executive_coaching_addon` — Yönetsel Koçluk Eklentisi (2 boyut)
- `business_context_integration` — İş bağlamını koçluk sürecine entegre etme
- `stakeholder_awareness` — Paydaş dinamiklerini görme

### B. `team_coaching_addon` — Takım Koçluğu Eklentisi (2 boyut)
- `group_dynamics_awareness` — Grup dinamiklerini okuma
- `conflict_navigation` — Çatışma yönetimine rehberlik

### C. `performance_coaching_addon` — Performans Koçluğu Eklentisi (2 boyut)
- `goal_clarity` — Hedef netliği yaratma
- `accountability_structure` — Hesap verebilirlik yapısı kurma

### D. `wellbeing_coaching_addon` — İyi Oluş Koçluğu Eklentisi (2 boyut)
- `emotional_regulation_support` — Duygu düzenleme desteği
- `meaning_making` — Anlam kurma becerisi

Her ek rubric ayrı bir template olarak tanımlanır; tenant admin'i isterse ICF + bir ek template'i birlikte aktive edebilir (kullanıcı seans seçiminde hangi framework'e göre değerlendirileceğini görür).

## Migration Referansı

Bu dokümana dayanarak yazılacak migration dosyası: `supabase/migrations/20260424_029_icf_rubric_standard_seed.sql`
