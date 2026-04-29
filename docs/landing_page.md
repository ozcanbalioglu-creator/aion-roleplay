# AION Mirror — Landing Page İçerik Brifi

> **Hedef:** Bu brifle Claude DESIGN feature'ı landing page'i tasarlayacak.
> İçerik buradan alınacak; tasarımcıya copy-ready metin + görsel ipuçları + bölüm amacı ile birlikte verilmiş olacak.
>
> **Audience:** Türkiye'deki orta-büyük ölçekli şirketlerin **HR/İK ve İK Eğitim & Gelişim (L&D) liderleri**, yöneticilik gelişim programlarını ICF çerçevesinde kurgulamak isteyen şirketler.
>
> **Konumlandırma:** Generik role-play eğitim aracı değil → **Yöneticilerin koçluk becerisini geliştiren ICF rubric tabanlı simülasyon platformu**.
>
> **Versiyon:** v1 · 2026-04-29

---

## 0. Marka Tonu ve Dil Rehberi

**Ton:** Profesyonel ama insan, B2B kurumsal ama soğuk değil. "Sen" hitabı (samimi/Türkçe doğal) yerine **"siz" hitabı** (kurumsal). Kapanış cümlelerinde sıcak.

**Anahtar mesaj kümeleri:**
- Yapay zeka değil — **yapay zekayla pratiğe dönüşen koçluk gelişimi**
- Eğitim değil — **deneyim**
- Soyut yetkinlik değil — **somut davranış değişimi**
- Tek seans değil — **takip edilen gelişim haritası**

**Yasaklı kelimeler/ifadeler:**
- "Devrim niteliğinde", "çığır açan" gibi şişirme dil
- "Robot", "bot" — bunun yerine "AI personası", "yapay zeka koç"
- "Kullanıcı" → kontekste göre "**yönetici**" veya "**ekip lideri**"
- "Müşteri" → "**kurum**" veya "**iş ortağı**"

**Renk paleti önerisi (Brand Guardian'a):** Mor-amber dual tone (mor = derin liderlik, amber = sıcak eylem). Koyu zemin (`#1a1a2e`, `#0f0e22`) hero ve cinematic bölümler için; açık zemin pillar/feature anlatımları için.

**Tipografi:** Headline serif italik (mevcut `font-headline` — italik vurgu duygusal yansıma için), body sans-serif.

---

## 1. Sayfa Bölüm Yapısı (top → bottom)

| # | Bölüm | Amaç | Tip |
|---|---|---|---|
| 1 | **Hero** | Anlık değer önerisi + CTA | Cinematic dark |
| 2 | **Müşteri logoları** (placeholder) | Sosyal kanıt | Beyaz strip |
| 3 | **Sorun cümlesi** | Niye var olduğunu söyle | Beyaz |
| 4 | **3-Adım Akış** | Nasıl çalışıyor | Beyaz, illüstratif |
| 5 | **Persona Galerisi** | Gerçek karakterler — somutluk | Koyu |
| 6 | **ICF Çerçevesi & 4 Pillar** | Akademik güvenilirlik | Beyaz |
| 7 | **Rapor Önizleme** | En güçlü farklılaştırıcı | Koyu, ekran görüntüsü |
| 8 | **Kuruma Faydalar** | HR/L&D karar verici için | Beyaz |
| 9 | **Yöneticiye Faydalar** | Son kullanıcı için | Açık mor zemin |
| 10 | **Oyunlaştırma & Gelişim Takibi** | Tutundurma argümanı | Koyu |
| 11 | **Güvenlik & Veri** | Kurumsal alıcı için kritik | Beyaz |
| 12 | **Demo CTA bandı** | İkinci dönüşüm noktası | Mor strip |
| 13 | **SSS** | Tereddütleri gider | Beyaz, accordion |
| 14 | **Footer** | Yasal + kontak | Koyu |

---

## 2. Hero Bölümü

**Görsel ipucu:** Sol blok metin, sağ blok cinematic — yöneticinin avatarı (silüet) ile karşı karşıya bir AI persona avatarı (bir başka silüet). Aralarında parlak bir mor halka — "yansıma anı" hissi. Background = koyu mor radial glow (mevcut `CinematicPersonaStage` estetiği).

### Headline (büyük, italik serif)
```
Liderlik, sahada öğrenilir.
Sahneyi biz kuruyoruz.
```

### Sub-headline (3 satır, açık tonalite)
```
AION Mirror, yöneticilerinizin gerçek koçluk konuşmalarını
yapay zeka personalarıyla pratik etmesini sağlar.
ICF rubric'ine göre puanlanmış raporlarla davranış değişimini ölçülebilir kılar.
```

### CTA Çifti
- Birincil (mor dolgu): **"Demo Talep Et"** → `/demo` (form sayfası)
- İkincil (outline): **"Kurumunuza Özel Senaryo"** → `#contact` (anchor)

### Hero altı mikro-trust strip
3 küçük rozet, ikon + tek kelime altı:
- 🛡 ICF Çerçeveli   ·   🔒 KVKK Uyumlu   ·   🇹🇷 Türkçe Doğal Konuşma

---

## 3. Müşteri Logoları (Placeholder Strip)

**Bölüm başlığı (ufak, uppercase):**
```
KURUMSAL EKİPLER NEDEN AION MIRROR'I SEÇİYOR
```

**Gri tonda, 6-8 logo placeholder.** Soft launch öncesi pilot kurum logolarını yerleştirmek için boş slotlar. DESIGN agent'a not: bu satıra `[LOGO 1]...[LOGO 8]` placeholder kutuları çıkar, aşağıda küçük bir notla "Pilot kurumlarımız soft launch sonrası burada" desin.

---

## 4. Sorun Cümlesi (Niye Varız)

**Bölüm başlığı:**
```
Yönetici geliştirme programlarının iki kronik sorunu.
```

**İki sütunlu mini-anlatım:**

**SORUN 1 — Pratik açığı**
> Eğitimde anlatılan koçluk teknikleri, iş yerinde gerçek konuşmaya
> dönmüyor. Yönetici eğitimden çıkar çıkmaz eski alışkanlıklara döner.
> Çünkü pratik için güvenli bir alan yok.

**SORUN 2 — Ölçüm açığı**
> "Anketle değerlendirme" davranış değişimini ölçemez. Hangi
> yöneticinizin gerçekten dinlediğini, hangisinin direktif moduna
> geri kaydığını veriyle göremezsiniz.

**Geçiş cümlesi (alt, vurgu):**
```
AION Mirror her ikisini de çözer: sınırsız pratik + somut ölçüm.
```

---

## 5. 3-Adım Akış

**Bölüm başlığı:**
```
Üç adımda gerçek koçluk pratiği.
```

**Sub-başlık:**
```
Hazırlık yok. Yapay zeka karşı tarafta hazır bekliyor.
```

### Adım 1
- **Görsel:** persona avatar grid + seçim ikonu
- **Başlık:** Karakteri ve senaryoyu seç
- **Açıklama (1-2 cümle):** Düşen performansla mücadele eden bir uzman mı, ekibe yeni katılan bir potansiyel mi, kendine güvensiz bir yetenek mi? Kurum ihtiyaçlarınıza göre seçtiğiniz personayla başlayın.

### Adım 2
- **Görsel:** mikrofon ikonu + ses dalgaları + transcript kesiti
- **Başlık:** Sesli koçluk konuşması yapın
- **Açıklama:** Mikrofona basın, doğal Türkçe konuşun. AI persona gerçek bir çalışan gibi tepki verir; sözünü kesin, derinleştirin, sessizliği kullanın. Sahadaki gibi.

### Adım 3
- **Görsel:** rapor önizleme (pillar mini kartları + skor)
- **Başlık:** Detaylı raporu inceleyin
- **Açıklama:** ICF rubric'inin 8 boyutunda puanlama, transcript'ten kanıt cümleler, "Doğru yaptıkların" + "Bundan kaçın" maddeleri ve **bir sonraki seans için tek odak**.

---

## 6. Persona Galerisi

**Bölüm başlığı:**
```
Karakterler hazır. Hangi konuşmayı pratik etmek istersiniz?
```

**Sub-başlık:**
```
Her persona, gerçek iş hayatından gözlemlenmiş bir karakter profilidir.
Kurum ihtiyaçlarınıza göre özelleştirme yapılabilir.
```

**4-6 persona kartı (mevcut DB'deki personalardan):**

### Kart yapısı
```
[Avatar foto, 200x200, B&W gradient hover'da renklenir]
[İsim Soyisim, italik serif]
[Ünvan · Departman, küçük caps]

[Karakter özeti — 2 cümle]

ZORLUK    DİRENÇ    BAŞARI EĞİLİMİ
●●●○○     ●●●●○     Yükselen ↗
```

### Örnek persona kartları (mevcut sistemden):
- **Selin Çelik** · İlaç Satış Mümessili — "Sahaya yeni atanmış, kendine güvensiz; A sınıfı doktorlara ulaşmakta zorlanıyor."
- **Ahmet Yılmaz** · Bölge Müdürü Adayı — "Yüksek performanslı ama agresif; ekibin moralini düşürüyor."
- **Murat Kaya** · Operasyon Sorumlusu — "Süreçleri eleştiriyor, sürekli onay arıyor, karar vermekte zorlanıyor."
- **Neslihan Bozkurt** · Proje Yöneticisi — "Düşen motivasyon; özel hayatla iş arasında denge sorunu."
- **Emre Demir** · Yazılım Mühendisi — "Yetenekli ama izolasyonu seven; ekiple iletişim yok."

**Alt CTA (mor link):**
```
→ Tüm persona kütüphanesini görün (12+ karakter)
```

---

## 7. ICF Çerçevesi ve 4 Pillar

**Bölüm başlığı:**
```
Akademik temelli, sahaya uygulanmış değerlendirme.
```

**Sub-başlık:**
```
Uluslararası Koçluk Federasyonu (ICF) Core Competencies 2019 çerçevesi
8 boyutu, 4 pillar altında ölçülür. Kurum kendi rubric'ini de kurabilir.
```

**Görsel ipucu:** 4 pillar dikey kartlarda, her pillar'ın içinde 2-3 boyut.

### Pillar A · Çerçeve & Etik (10 puan)
- **A1** Etik Uygulamaları Sergiler
- **A2** Anlaşmaları Kurar ve Sürdürür

### Pillar B · Varlık & Güven (15 puan)
- **B1** Koçluk Zihniyetini Somutlaştırır
- **B2** Güven ve Güvenlik Duygusunu Geliştirir
- **B3** Varlığını Sürdürür

### Pillar C · Sorgulama (10 puan)
- **C1** Aktif Olarak Dinler
- **C2** Farkındalık Yaratır

### Pillar D · Büyüme (5 puan)
- **D1** Danışanın Gelişimini Kolaylaştırır

**Alt mini-not (italik):**
```
Toplam 40 puanlı bir analiz. Her boyut için 1-5 arası puan,
transcript'ten kanıt cümle ve gelişim önerisi.
```

---

## 8. Rapor Önizleme — En Güçlü Farklılaştırıcı

**Bölüm başlığı:**
```
"İyi geçti" değil; "Şu cümlede şunu yaptın, şunu yapma."
```

**Sub-başlık:**
```
Her seans sonunda yöneticinizin elinde 3 şey var:
ICF rubric'ine göre 8 boyutlu detay analizi, transcript'ten
kanıt alıntıları ve bir sonraki seans için tek bir odak cümlesi.
```

### Görsel ipucu (DESIGN agent için kritik)
Bu bölüm bir **mockup ekran** olmalı. Mockup'ta görünmesi gerekenler:
- Üstte hero scorecard: `28 / 40 · Gelişen Liderlik Profili`
- Altında 4 pillar mini-kart (A B C D)
- Açık bir pillar detay paneli içinde:
  - **A1 · Etik Uygulamaları Sergiler   3 / 5**
  - 📋 Kanıt: "Bu konuyu çevrendekilerle paylaşmak isteyip istemediğine sen karar veriyorsun..."
  - ✅ DOĞRU YAPTIĞIN: "Danışanın özerkliğine saygıyı net cümleyle ortaya koydun."
  - ⚠️ BUNDAN KAÇIN: "Sınır cümlesini sadece bir kez kurdun; konu zorlaştığında tavsiye moduna geçtin."
- Sağda **Bir Sonraki Odak** kartı: "Bir sonraki seansa açık uçlu sorularla başla."

**3 vurgu nokta (mockup altında, ikon + 1 cümle):**
- 🎯 **Tek odak cümlesi** — Yönetici ne yapacağını net biliyor.
- 📋 **Transcript'ten kanıt** — Soyut değil, somut. "Şu dakikada şu cümleyi söyledin."
- 🔁 **Trend takibi** — 5 seans sonra hangi pillar'ın güçlendiğini görürsünüz.

---

## 9. Kuruma Faydalar (HR/L&D Karar Verici)

**Bölüm başlığı:**
```
Kurum koçluk kültürünüzü ölçülebilir hale getirin.
```

### 4 fayda kartı (ikon + başlık + 2 cümle)

#### 🏢 Ölçeklenebilir Geliştirme
50 yöneticiyi haftada bir kez koçla buluşturmak imkansız. AION Mirror her yönetici için sınırsız tekrarlanabilir, anında erişilebilir bir prova alanı sağlar.

#### 📊 Kohort Heatmap
Hangi pillar'da ekibinizin zayıf olduğunu, hangisinde güçlü olduğunu kohort bazında görün. Eğitim yatırımlarınızı veriyle yönlendirin.

#### 🎯 Kurum Senaryoları
Genel senaryolar yetmez. Kendi sektörünüze, müşteri profilinize, çalışan dinamiklerinize özel personalar ve senaryolar oluşturun.

#### 🏆 Yetenek Sinyali
Hangi yöneticiniz koçluk-merkezli, hangisi direktif eğilimli? Promosyon ve görev rotasyonu kararları için davranışsal veri.

---

## 10. Yöneticiye Faydalar (Son Kullanıcı)

**Bölüm başlığı:**
```
Çalışanlarınızla yapacağınız zor konuşmaları önce burada deneyin.
```

### 4 fayda kartı (ikon + başlık + 2 cümle)

#### 🎙 Sınırsız Pratik
Düşen performansla konuşmak korkutucu olabilir. Önce burada beş kez deneyin, gerçek konuşmaya hazır gelin.

#### 🪞 Gerçek Yansıma
Konuştuktan sonra debrief koçumuz sizinle bir geri bildirim sohbeti yapar. "Nasıl hissettin? Ne öğrendin?" — sıcak ve içten.

#### 📈 Kişisel Gelişim Haritası
5 seans sonra hangi pillar'da ilerlediğinizi, hangisinde tıkandığınızı görürsünüz. Body 4 pillar grafiği gibi okunabilir.

#### 🏅 Oyunlaştırma
XP, seviye atlama, rozet koleksiyonu, haftalık görevler. Gelişim yolculuğunu bir oyun gibi takip edin.

---

## 11. Oyunlaştırma & Gelişim Takibi

**Bölüm başlığı:**
```
Davranış değişimi alışkanlık gerektirir. Alışkanlık ödüllendirilirse oluşur.
```

**Sub-başlık:**
```
AION Mirror'da her seans, her ilerleme, her kazanım takip edilir ve ödüllendirilir.
```

### 3 görsel kart

**Kart 1 — Seviyeler**
- 🌱 Koçluk Yolcusu (L1)
- ⭐ Gelişen Koç (L2)
- 🏅 Yetkin Koç (L3)
- 🏆 Uzman Koç (L4)
- 👑 Usta Koç (L5)

**Kart 2 — Rozetler**
"İlk Seans", "Üç Gün Üst Üste", "Pillar B Ustası", "Sessizlik Sanatçısı" — kazanılan rozetlerle yöneticinizin gelişim haritası zenginleşir.

**Kart 3 — Haftalık Görevler**
Her hafta yeni bir mikro-meydan okuma. "Bu hafta 3 farklı persona ile konuş", "Pillar C'de 4'ün üstünde puan al" gibi.

---

## 12. Güvenlik & Veri Korunması (kurumsal alıcı için kritik)

**Bölüm başlığı:**
```
Kurum verilerinizi olduğu yerde tutuyoruz.
```

### 4 satırlık güvence

#### 🔒 KVKK ve GDPR Uyumlu
Tüm transcript'ler şifrelenmiş olarak saklanır (AES-256-GCM). Kurum talep ederse veriler kalıcı silinir.

#### 🇹🇷 Veri Yerelliği
Türkiye merkezli barındırma seçeneği mevcuttur. Veri sınır ötesine geçmez.

#### 🛡 Multi-Tenant İzolasyon
Kurum verileri Postgres Row-Level Security ile birbirinden izole edilir. Başka bir kurum sizin verinizi göremez.

#### 📋 Erişim Kontrolü
6 farklı rol (Kullanıcı, Yönetici, HR Görüntüleyici, HR Admin, Tenant Admin, Süper Admin) ile granüler yetkilendirme.

---

## 13. Demo CTA Bandı (orta sayfa dönüşüm)

**Görsel ipucu:** Tam genişlik mor (`#9d6bdf` → `#7a4dc4` gradient) bandı, ortada beyaz başlık.

### Başlık
```
30 dakikalık demo. Sıfır taahhüt.
```

### Sub-headline
```
Kendi senaryonuzla bir prova seans yapalım. Raporu ekrana açalım.
Ekiplerinize uygun olup olmadığını birlikte değerlendirelim.
```

### Form (sade, 4 alan)
- Ad Soyad (zorunlu)
- Kurumsal e-posta (zorunlu)
- Şirket adı (zorunlu)
- Çalışan sayısı (dropdown: <50, 50-200, 200-1000, 1000+)

**Buton:** **"Demo Talep Et"** (büyük, beyaz dolgu, mor metin)

**Mikro-not (form altında):**
```
Bilgileriniz Aydınlatma Metni kapsamında işlenir.
Spam göndermiyoruz; en geç 24 saat içinde dönüş yapıyoruz.
```

---

## 14. SSS (Sıkça Sorulan Sorular)

**Bölüm başlığı:**
```
Sıkça sorulan sorular.
```

**Tip:** Accordion. 8 soru, ilki default açık.

### S1 — AION Mirror kimler için uygundur?
Yönetici geliştirme programları yürüten, koçluk merkezli liderlik kültürü kurmak isteyen kurumlar için. Özellikle:
- Sahada yönetici tutan, hızlı geliştirilmesi gereken pozisyonlar (satış, operasyon, üretim)
- Promosyon öncesi yönetici adayı havuzu
- Mevcut yöneticilerin koçluk becerisini ölçmek/geliştirmek isteyen HR fonksiyonları

### S2 — Hangi senaryolar mevcut?
Kullanıma hazır 12+ persona ve 20+ senaryo bulunmaktadır. Düşen performans, ekip içi çatışma, kariyer planlama, motivasyon kaybı, performans değerlendirme görüşmesi gibi yaygın yönetici durumları. Ek olarak kurumunuza özel senaryolar oluşturulabilir.

### S3 — Yapay zeka ne kadar gerçekçi?
Sistem GPT-4o tabanlı LLM ile çalışır; sesli iletişim için ElevenLabs Türkçe doğal sesler kullanılır. Personalar gerçek davranışsal patternlere göre tasarlanmıştır (yüksek/düşük direnç, işbirliği seviyesi, duygusal dengenin değişkenliği). Konuşma akıcı, kesintisiz ve doğaldır.

### S4 — Değerlendirme nasıl yapılıyor?
ICF Core Competencies 2019 çerçevesinin 8 boyutu üzerinden, transcript'in tamamı analiz edilerek puanlama yapılır. Her boyut için 1-5 arası puan + transcript'ten kanıt cümle + "doğru yaptığın / bundan kaçın" şeklinde gelişim önerisi verilir.

### S5 — Kurumsal entegrasyon gerekiyor mu?
Hayır. Tarayıcı üzerinden çalışır, ek kurulum gerekmez. SSO entegrasyonu (Azure AD, Google Workspace) opsiyonel olarak yapılabilir. Toplu kullanıcı eklemek için CSV/Excel yükleme arayüzü mevcuttur.

### S6 — Veri güvenliği nasıl sağlanıyor?
- Tüm seans transcript'leri AES-256-GCM ile şifreli saklanır
- Multi-tenant Postgres Row-Level Security: kurumlar arası veri izolasyonu
- Ses kayıtları kalıcı saklanmaz; yalnızca metne dönüştürülür
- KVKK ve GDPR uyumlu işleme; talep üzerine kalıcı silme
- Türkiye merkezli barındırma seçeneği

### S7 — Mobil cihazda çalışıyor mu?
Web tarayıcı üzerinden tüm cihazlarda çalışır (Chrome, Safari, Edge, Firefox). Native mobil uygulama yol haritasında, 2026 üçüncü çeyrekte planlanmıştır.

### S8 — Fiyatlandırma nasıl?
Kurum büyüklüğüne ve seans hacmine göre özelleştirilmiş paketler sunarız. Demo görüşmesinde ihtiyacınızı dinler ve uygun lisans modelini birlikte belirleriz. Pilot dönem (90 gün) seçeneği mevcuttur.

---

## 15. Footer

### Sol kolon — Marka
- AION Mirror logosu
- "Liderlik, sahada öğrenilir."
- Sosyal medya ikonları (LinkedIn öncelikli — B2B)

### Orta sol — Ürün
- Özellikler
- Persona Kütüphanesi
- ICF Çerçevesi
- Güvenlik
- SSS

### Orta sağ — Kurumsal
- Hakkımızda
- Demo Talep
- İletişim
- Kariyer

### Sağ — Yasal
- Kullanım Koşulları
- Gizlilik Politikası
- KVKK Aydınlatma Metni
- Çerez Politikası

### Alt strip
```
© 2026 AION Mirror · Bu platform AION More tarafından geliştirilmiştir.
ISO 27001 (planlanan) · KVKK Uyumlu · GDPR Uyumlu
```

**Adres ve iletişim:**
- contact@mirror.aionmore.com
- [Şirket adresi placeholder]

---

## 16. Görsel Asset Listesi (DESIGN agent için)

### Mevcut (kullanılabilir)
- 5 persona avatar fotoğrafı (B&W stil, var)
- AION Mirror logosu (mevcut)
- ACME tenant logosu (geçici placeholder)
- Mor radial glow background pattern (CSS, mevcut)

### Yeni üretilmesi gereken
- Hero illüstrasyon (yönetici × AI persona silüet, mor halka)
- 3-adım flow ikonografisi
- Pillar diagram (4 pillar görselleştirme)
- Rapor mockup ekran görüntüsü (figma/screenshot)
- ICF rubric gridi (8 boyut görsel açıklamada)
- 6-8 müşteri logo placeholder kutusu
- Trust badge ikonları (KVKK, ICF, ISO)

---

## 17. SEO ve Meta

**Page title:**
```
AION Mirror — AI Destekli Koçluk Pratiği Platformu | Yöneticiler İçin
```

**Meta description (155 char):**
```
Yöneticilerinizin koçluk becerisini AI personalarıyla pratiğe dönüştürün. ICF rubric tabanlı detaylı raporlama. Demo için iletişime geçin.
```

**OG image:** Hero illüstrasyon + tagline.

**Anahtar kelimeler (SEO için):**
- yönetici koçluğu
- AI role play eğitim
- ICF koçluk rubric
- liderlik gelişim platformu
- yapay zeka koçluk
- yönetici geliştirme programı

---

## 18. Performans ve Erişilebilirlik Notları

- **Hero animasyonu:** Subtle parallax veya gradient breathing — distract etmesin.
- **Mobil:** Tüm bölümler dikey akış, persona galerisi yatay swipe.
- **Erişilebilirlik (WCAG AA):**
  - Hero başlık kontrast 7:1 minimum
  - Tüm CTA'lar keyboard-navigable
  - Persona kart hover'ı dokunma cihazlarında tap ile çalışsın
  - Form'da `aria-label`'lar
- **Performance:**
  - Hero LCP < 2.5s (görsel WebP/AVIF)
  - Lazy load: persona galerisi ve aşağı bölümler

---

## 19. Konum Önerisi

**Route:** `/` (anasayfa)
**Login route:** `/login`
**Demo formu:** `/demo` (ayrı sayfa veya modal)

**Mevcut akış değişimi:**
- Giriş yapmamış kullanıcı `/` → bu landing page
- "Giriş Yap" butonu sağ üstte → `/login`
- "Demo Talep Et" → `/demo` form
- Giriş yapmış kullanıcı `/` → otomatik `/dashboard` yönlendirmesi

---

## 20. Onay ve Sıradaki Adım

**Bu briften DESIGN agent'a vereceğimiz girdi:**
1. Bu MD dosyası (yapı + copy)
2. Marka tonu rehberi (§0)
3. Mevcut estetik referansları (`CinematicPersonaStage`, sidebar, mor radial glow, headline italik serif)
4. Görsel asset listesi (§16)

**Önce sen onayla:**
- [ ] §0 marka tonu uygun mu? "Siz" hitabı tercihin?
- [ ] Konumlandırma doğru mu (yöneticilere özel ICF temelli)?
- [ ] Bölüm sıralaması (§1) mantıklı mı?
- [ ] Hero headline cümlesi ("Liderlik, sahada öğrenilir") çekici mi yoksa farklı bir tone mu? (alternatif: "Koçluk konuşmaları, gerçek sahaya çıkmadan önce burada")
- [ ] Demo dışında başka CTA istiyor musun (örn. "Pilot başlat", "Beta'ya katıl")?
- [ ] Eklemek/çıkarmak istediğin bölüm var mı?
- [ ] Müşteri logoları placeholder mı kalsın, yoksa pilot kurumu lansmandan ÖNCE eklemeyi mi tercih edersin?
- [ ] Persona galerisinde kullanılacak personaları belirledin mi (5 kart önerimde)?

Onay sonrası DESIGN agent'a iletilir, görsel mockup üretilir, sonra Frontend Developer agent uygular.

---

_Hazırlayan: Claude · 2026-04-29 akşam_
_Konum: `docs/landing_page.md`_
_Referans alınan: `https://www.enocta.com/urunler/enocta-personas`_
_İlham düzeyi: Yapı (3-step flow, persona galerisi, FAQ) ödünç. İçerik ve konumlandırma TAMAMEN bağımsız._
