-- Migration 031: ICF Standart Rubric Seed (P2-109)
-- 1. rubric_templates'e is_locked kolonu ekle
-- 2. rubric_dimension_code enum'a 8 ICF kodu ekle
-- 3. ICF standart rubric template ve 8 boyutunu seed et

-- ─── 1. is_locked kolonu ─────────────────────────────────────────────────────
ALTER TABLE rubric_templates
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. Enum genişletme ──────────────────────────────────────────────────────
ALTER TYPE rubric_dimension_code ADD VALUE IF NOT EXISTS 'ethical_practice';
ALTER TYPE rubric_dimension_code ADD VALUE IF NOT EXISTS 'coaching_mindset';
ALTER TYPE rubric_dimension_code ADD VALUE IF NOT EXISTS 'establishes_agreements';
ALTER TYPE rubric_dimension_code ADD VALUE IF NOT EXISTS 'cultivates_trust';
ALTER TYPE rubric_dimension_code ADD VALUE IF NOT EXISTS 'maintains_presence';
ALTER TYPE rubric_dimension_code ADD VALUE IF NOT EXISTS 'listens_actively';
ALTER TYPE rubric_dimension_code ADD VALUE IF NOT EXISTS 'evokes_awareness';
ALTER TYPE rubric_dimension_code ADD VALUE IF NOT EXISTS 'facilitates_growth';

-- ─── 3. ICF Standart Rubric Seed ─────────────────────────────────────────────
DO $$
DECLARE
  v_admin_id  UUID;
  v_rubric_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM users ORDER BY created_at LIMIT 1;
  END IF;

  -- Daha önce eklenmişse atla
  IF EXISTS (SELECT 1 FROM rubric_templates WHERE name = 'ICF Koçluk Yetkinlikleri v1') THEN
    RAISE NOTICE 'ICF rubric zaten mevcut, atlanıyor.';
    RETURN;
  END IF;

  INSERT INTO rubric_templates (name, description, is_default, is_active, is_locked, created_by)
  VALUES (
    'ICF Koçluk Yetkinlikleri v1',
    'ICF Core Competencies 2019 çerçevesine dayalı 8 boyutlu standart koçluk değerlendirme rubriği. Kilitli — içerik değiştirilemez.',
    false,
    true,
    true,
    v_admin_id
  )
  RETURNING id INTO v_rubric_id;

  INSERT INTO rubric_dimensions
    (template_id, dimension_code, name, description, is_required, is_active, sort_order, score_labels)
  VALUES
  (
    v_rubric_id, 'ethical_practice',
    'Etik Uygulamaları Sergiler',
    'Koçluk etik kurallarına bağlılık, mesleki sınır koruma, gizlilik ve rol netliği.',
    true, true, 1,
    '{"1":"Mesleki sınırları ihlal eder, kişisel yargı dayatır","2":"Sınırları zaman zaman koruyamaz, etik hassasiyet yüzeysel","3":"Genel olarak koçluk sınırları içinde kalır, nadir sapmalar","4":"Etik duruş tutarlı, danışan özerkliğine saygı belirgin","5":"Etik hassasiyet seansın her anına nüfuz eder, zorlu ikilemlerde net duruş"}'::jsonb
  ),
  (
    v_rubric_id, 'coaching_mindset',
    'Koçluk Zihniyetini Somutlaştırır',
    'Açık, meraklı, esnek ve danışan-merkezli zihniyet; önyargı yönetimi, sürekli gelişim.',
    true, true, 2,
    '{"1":"Yargılayıcı veya direktif, kendi çözümünü dayatır","2":"Zaman zaman danışan-merkezli ama kendi agenda''sına geri döner","3":"Genel olarak açık ve meraklı, önyargıları her zaman yönetemez","4":"Danışan-merkezli duruş tutarlı, merak samimi ve derinleştirici","5":"Danışanın hizmetine sunan zihniyet içselleşmiş, kendi varsayımlarını açıkça sorgular"}'::jsonb
  ),
  (
    v_rubric_id, 'establishes_agreements',
    'Anlaşmaları Kurar ve Sürdürür',
    'Seans amacı, başarı kriterleri ve ölçülebilir çıktıyı birlikte netleştirme.',
    true, true, 3,
    '{"1":"Seans amacı hiç tanımlanmaz ya da tek taraflı belirlenir","2":"Amacı sorar ama yüzeysel kalır, ölçülebilir çıktı yok","3":"Amacı netleştirir ve onay alır, başarı kriteri belirsiz kalabilir","4":"Amaç + başarı kriteri + somut çıktı birlikte kurgulanır","5":"Gerçek ihtiyaç ile ilan edilen konu arasındaki farkı fark eder ve yeniden anlaşır"}'::jsonb
  ),
  (
    v_rubric_id, 'cultivates_trust',
    'Güven ve Güvenlik Duygusunu Geliştirir',
    'Saygı, empati, kabul ve doğrulukla psikolojik güvenli alan yaratma.',
    true, true, 4,
    '{"1":"Yargılayıcı/ithamkar dil, empati yok","2":"Yüzeysel nezaket, duygulara yer vermiyor","3":"Saygılı ve kabullenici tutum, duygulara atıfta bulunur","4":"Empati belirgin ve ifade edilir, kırılgan anlara alan tutar","5":"Danışanın en kırılgan yanlarını açmasına olanak tanıyan bağ, güven seans boyunca artar"}'::jsonb
  ),
  (
    v_rubric_id, 'maintains_presence',
    'Tam Anlamıyla Hazır Bulunur',
    'Anda kalma, dikkat, farkındalıklı tepki ve belirsizlikle rahat etme.',
    true, true, 5,
    '{"1":"Hazırlanmış şablon sorular sıralar, danışanın söylediğine tepki vermez","2":"Zaman zaman dinler ama dikkat çabuk kayar, sık konu değişimi","3":"Dikkat çoğunlukla danışanda, son söylenene yanıt verir","4":"Mevcudiyet hissedilir, enerji ve ses tonu değişimleri fark edilir","5":"Tam hazır — koç ve danışan birlikte keşif modunda, sessizlik verimli kullanılır"}'::jsonb
  ),
  (
    v_rubric_id, 'listens_actively',
    'Etkin Dinler',
    'Söyleneni, söylenmeyeni ve altta yatan anlamı dinleme; özetleme, yansıtma, kontrol.',
    true, true, 6,
    '{"1":"Danışanın üzerine atlar, kendi düşüncesini anlatır","2":"Yüzeysel dinler, anlam katmanını kaçırır, yansıtma zayıf","3":"Temel özetleme ve yansıtma yapar, anlamadığında sorar","4":"Söylenmeyeni de duyar, yansıtmalar derin ve değerlidir","5":"Meta-dinleme: söylenen, söylenmeyen, ima edilen tüm katmanlar yakalanır"}'::jsonb
  ),
  (
    v_rubric_id, 'evokes_awareness',
    'Farkındalığı Uyandırır',
    'Güçlü sorular, yansıtmalar ve gözlemlerle danışanın içgörü ve yeni bakış açısı keşfi.',
    true, true, 7,
    '{"1":"Kapalı sorular, tavsiyeler, hazır çözüm önerileri","2":"Açık sorular var ama ne/nasıl ile sınırlı, varsayımlar sorgulanmaz","3":"Anlamlı sorular sorar, varsayımları zaman zaman sorgular","4":"Güçlü sorular danışanın bakış açısını değiştirir, içgörü anları belirgin","5":"Sorular danışanı durdurup düşündürür, farkındalık seans boyunca katmanlı gelişir"}'::jsonb
  ),
  (
    v_rubric_id, 'facilitates_growth',
    'Danışanın Gelişimini Kolaylaştırır',
    'Farkındalığı eyleme dönüştürme; özerklik destekli somut adımlar, taahhüt ve ilerleme.',
    true, true, 8,
    '{"1":"Aksiyon adımı yok veya tamamen koç tarafından empoze edilir","2":"Ne yapacaksın sorusu var ama derinleştirilmez, adımlar belirsiz","3":"Danışan somut bir sonraki adım belirler, zaman/ölçüt zayıf","4":"Aksiyon adımları SMART''a yakın, olası engeller konuşulur","5":"Adımlar danışanın içsel motivasyonundan doğar, seans sonunda enerji yüksek ve yön berrak"}'::jsonb
  );

  RAISE NOTICE 'ICF Rubric oluşturuldu. ID: %', v_rubric_id;
END $$;
