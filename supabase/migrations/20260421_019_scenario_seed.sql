-- Migration 019: Rubric template + 9 scenario seed
-- Adım 1: Varsayılan koçluk rubriğini oluştur
-- Adım 2: 9 pharma coaching senaryosunu ekle

DO $$
DECLARE
  v_murat_id   UUID := '3ae4f14a-ce48-4317-87ce-4e0fcfd0b8a6';
  v_selin_id   UUID := '13175ba6-73b0-48bd-8ee0-1bd17774eb22';
  v_ahmet_id   UUID := '7eb74468-c28f-4d8c-82b0-69f111bb7931';
  v_admin_id   UUID;
  v_rubric_id  UUID;
BEGIN

  -- Admin kullanıcıyı bul
  SELECT id INTO v_admin_id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM users ORDER BY created_at LIMIT 1;
  END IF;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'users tablosunda hiç kullanıcı yok.';
  END IF;

  -----------------------------------------------------------------------
  -- ADIM 1: Varsayılan rubric template
  -----------------------------------------------------------------------
  INSERT INTO rubric_templates (name, description, is_default, is_active, created_by)
  VALUES (
    'Koçluk Yetkinlik Rubriği v1',
    'İlaç sektörü yönetici koçluğu için standart değerlendirme rubriği. 6 zorunlu + 6 seçmeli boyut.',
    true,
    true,
    v_admin_id
  )
  RETURNING id INTO v_rubric_id;

  -----------------------------------------------------------------------
  -- ADIM 2: Rubric boyutları
  -----------------------------------------------------------------------
  INSERT INTO rubric_dimensions (template_id, dimension_code, is_required, sort_order, score_labels) VALUES
  -- Zorunlu boyutlar
  (v_rubric_id, 'active_listening',   true,  1,
   '{"1":"Neredeyse hiç dinlemiyor, sözü kesiyor","2":"Kısmen dinliyor","3":"Çoğunlukla dinliyor","4":"Aktif dinliyor, yansıtıyor","5":"Derin dinleme, sözsüz sinyalleri de yakalar"}'::jsonb),
  (v_rubric_id, 'powerful_questions', true,  2,
   '{"1":"Kapalı veya yönlendirici sorular","2":"Bazı açık sorular var","3":"Düzenli açık sorular soruyor","4":"Derinleştiren, farkındalık yaratan sorular","5":"Dönüştürücü sorular, yeni perspektif açıyor"}'::jsonb),
  (v_rubric_id, 'summarizing',        true,  3,
   '{"1":"Hiç özetleme yok","2":"Nadir özetliyor","3":"Ara sıra özetliyor","4":"Düzenli ve doğru özetliyor","5":"Özetleme ile derinleştiriyor, kişinin kendini duyulmuş hissettiriyor"}'::jsonb),
  (v_rubric_id, 'empathy',            true,  4,
   '{"1":"Duygusal içeriği görmezden geliyor","2":"Yüzeysel onaylama","3":"Duyguları fark ediyor ve isimlendiriyor","4":"Güçlü empati, perspektif alıyor","5":"Empati derin güven ortamı yaratıyor"}'::jsonb),
  (v_rubric_id, 'action_clarity',     true,  5,
   '{"1":"Görüşme belirsiz bitiyor, adım yok","2":"Belirsiz niyet var","3":"Genel bir eylem belirlenmiş","4":"Somut, ölçülebilir adımlar var","5":"SMART plan, sorumluluk ve takip neti"}'::jsonb),
  (v_rubric_id, 'non_judgmental',     true,  6,
   '{"1":"Açık yargılama veya eleştiri var","2":"İnce yargılayıcı mesajlar","3":"Genellikle tarafsız","4":"Tutarlı yargısız dil","5":"Tamamen kabullenici, güvenli alan yaratıyor"}'::jsonb),

  -- Seçmeli boyutlar
  (v_rubric_id, 'assumption_challenging', false, 7,
   '{"1":"Varsayımları hiç sorgulamıyor","2":"Nadir sorgulama","3":"Bazı varsayımları gösteriyor","4":"Kısıtlayıcı inançları ustalıkla sorgular","5":"Derin inanç sistemi dönüşümüne kapı açıyor"}'::jsonb),
  (v_rubric_id, 'responsibility_opening', false, 8,
   '{"1":"Sorumluluk hiç ele alınmıyor","2":"Zayıf sorumluluk çerçevesi","3":"Sorumluluk konuşuluyor","4":"Kişi kendi payını açıkça görüyor","5":"İçten gelen sorumluluk ve eylem isteği oluşuyor"}'::jsonb),
  (v_rubric_id, 'goal_alignment',         false, 9,
   '{"1":"Hedefler belirsiz veya yok","2":"Yüzeysel hedef var","3":"Genel hedef netleşti","4":"Anlamlı ve kişisel hedef hizalandı","5":"Hedef derin motivasyonla bağlandı"}'::jsonb),
  (v_rubric_id, 'feedback_quality',       false, 10,
   '{"1":"Geri bildirim yok ya da zararlı","2":"Belirsiz geri bildirim","3":"Davranış odaklı geri bildirim","4":"Somut, gelişim odaklı, zamanlı","5":"Ustaca verilmiş, içselleştirilmiş geri bildirim"}'::jsonb),
  (v_rubric_id, 'silence_management',     false, 11,
   '{"1":"Sessizliği hemen dolduruyor","2":"Kısa sessizliğe tolerans","3":"Sessizliği zaman zaman kullanıyor","4":"Sessizliği bilinçli kullanıyor","5":"Sessizlik dönüşüm aracı olarak kullanılıyor"}'::jsonb),
  (v_rubric_id, 'reframing',              false, 12,
   '{"1":"Yeniden çerçeveleme yok","2":"Zayıf çerçeve değişikliği denemesi","3":"Bir durumu farklı gösteriyor","4":"Etkili reframing, yeni perspektif açıyor","5":"Dönüştürücü reframing, köklü bakış açısı değişimi"}'::jsonb);

  -----------------------------------------------------------------------
  -- ADIM 3: 9 Senaryo
  -----------------------------------------------------------------------
  INSERT INTO scenarios (
    title, description, context_setup,
    persona_id, rubric_template_id,
    target_dimension_codes, optional_dimension_codes,
    difficulty, difficulty_level, estimated_duration_min,
    target_skills, sector_tags, tenant_id, is_active, created_by
  ) VALUES

  -- ── MURAT ──────────────────────────────────────────────────────────
  (
    'Plato Kırma: Deneyimli Yolların Sorgulanması',
    'Murat 8 yıllık kıdemiyle sahada otorite olmuş bir mümessil. Ancak son çeyrekte KPI''ları %15 geriledi. Her sorunun kaynağı olarak dışsal faktörleri gösteriyor: pazar baskısı, rakip fiyatları, doktorların meşguliyeti. Bu görüşmede kendi yaklaşımındaki değişim ihtiyacını fark etmesini sağlamak için koçluk yapmalısın. Güçlü sorularla kendi rol payını keşfetmesine alan aç; değişim için iç motivasyon oluşturmaya odaklan.',
    'Bu görüşmeye savunmacı giriyorsun. Performans düşüşünü kabul ediyorsun ama hep dış nedenlere bağlıyorsun. Doğrudan eleştiriye "evet ama" kalıbıyla karşılık veriyorsun. Yöneticinin kendi yaklaşımını sorgulayan sorularına başta dirençle, ısrarcı ve empatiyle devam ederse yavaşça kendi içine bakarak gerçekçi bir öz-değerlendirme yapıyorsun. Kızgın değil, pasif dirençlisin. Seanstaki rolün: ilaç mümessili Murat, yöneticinin koçluk görüşmesinde.',
    v_murat_id, v_rubric_id,
    ARRAY['active_listening','powerful_questions','summarizing']::rubric_dimension_code[],
    ARRAY['assumption_challenging','responsibility_opening']::rubric_dimension_code[],
    4, 4, 20,
    ARRAY['active_listening','powerful_questions','assumption_challenging','responsibility_opening','summarizing'],
    ARRAY['pharma','sales_coaching'], NULL, true, v_admin_id
  ),
  (
    'Yeni Ürün, Eski Alışkanlıklar',
    'Şirket yeni bir kardiyoloji ürünü için farklı bir ziyaret metodolojisi benimsedi. Murat eski yönteminin daha iyi işe yaradığına inanıyor ve eğitimleri "teorik" buluyor; kilit doktorlarda yeni yaklaşımı uygulamıyor. Bu görüşmede onun değişime direncinin altındaki korkuyu empatiyle açığa çıkarmalı ve yeni yaklaşımı kendi istemiyle denemesini sağlamalısın.',
    'Teknik ve metodolojik argümanlarla değişime direnç gösteriyorsun. "8 yılda doktoru nasıl ikna edeceğimi öğrendim" diyorsun. Şirketin yaklaşımını teorik, gerçek sahayla bağdaşmaz buluyorsun. Aslında belirsizlikten ve yeni yöntemde başarısız olmaktan korkuyorsun ama bunu kabul etmiyorsun. Yönetici empatiyle yaklaşır, korkunu yumuşatacak güvence verirse ve değişimin sana ne kazandırabileceğini keşfettirirse yavaşça açılıyorsun. Seanstaki rolün: ilaç mümessili Murat, yöneticinin koçluk görüşmesinde.',
    v_murat_id, v_rubric_id,
    ARRAY['empathy','active_listening','non_judgmental']::rubric_dimension_code[],
    ARRAY['reframing','assumption_challenging','goal_alignment']::rubric_dimension_code[],
    5, 5, 20,
    ARRAY['empathy','reframing','assumption_challenging','active_listening','goal_alignment'],
    ARRAY['pharma','change_management'], NULL, true, v_admin_id
  ),
  (
    'Takıma Etki: Kıdemli Çalışanın Sorumluluğu',
    'Murat''ın genç mümessiller önünde şirket kararlarını açıkça eleştirdiğine dair geri bildirimler geliyor. Bu durum ekibin motivasyonunu olumsuz etkiliyor. Görüşmenin amacı, suçlamadan ve yargılamadan Murat''ın bu davranışın etkisini fark etmesini ve kıdemli çalışan olarak ekip üzerindeki rolünü sahiplenmesini sağlamak.',
    'Durumu hafife alıyorsun; "sadece gerçekçi davranıyorum, yalanı neden söyleyeyim" diyorsun. Başta savunmacısın. Ancak yönetici yargılamadan, somut gözlemlerle etkiyi gösterirse bir an gerçekten dinliyorsun. İçinde kıdemlilerin sorumluluğunu taşıdığına dair bir değer var ama ego bunu örtüyor. Empatiyle sürdürülen bir konuşmada bu değere ulaşılabiliyor ve sorumluluk almak istiyorsun. Seanstaki rolün: ilaç mümessili Murat, yöneticinin koçluk görüşmesinde.',
    v_murat_id, v_rubric_id,
    ARRAY['non_judgmental','empathy','action_clarity']::rubric_dimension_code[],
    ARRAY['feedback_quality','responsibility_opening']::rubric_dimension_code[],
    5, 5, 15,
    ARRAY['non_judgmental','feedback_quality','empathy','powerful_questions','responsibility_opening'],
    ARRAY['pharma','team_dynamics'], NULL, true, v_admin_id
  ),

  -- ── SELİN ──────────────────────────────────────────────────────────
  (
    'Bir Sonraki Seviyeye Geçiş: A Sınıfı Hesaplar',
    'Selin tutarlı biçimde hedeflere ulaşıyor ancak yüksek reçete hacimli (A sınıfı) doktorlara giremedi. Son iki çeyrektir bu hesaplara hiç ziyaret yapmadı. Bu görüşmede engelleri birlikte keşfetmeli, Selin''in kendi gücünü görmesini sağlamalı ve onun istemiyle oluşturduğu bir gelişim planıyla ayrılmalısın.',
    'Başarılı olduğunu biliyorsun ama A sınıfı doktorların "farklı bir liga" olduğunu düşünüyorsun. Bilinçdışı bir öz-sansür var; "zaten girersem ne değişecek ki" tarzı bir şüphecilik. Redden korkuyorsun ama bunu açıkça söylemiyorsun. Yönetici seni zorlayan soruları sevecenlikle sorarsa ve kendi gücünü görmene yardım ederse motive oluyorsun ve güçlü hedefler belirlemek istiyorsun. Seanstaki rolün: ilaç mümessili Selin, yöneticinin koçluk görüşmesinde.',
    v_selin_id, v_rubric_id,
    ARRAY['active_listening','powerful_questions','action_clarity']::rubric_dimension_code[],
    ARRAY['goal_alignment','assumption_challenging']::rubric_dimension_code[],
    3, 3, 20,
    ARRAY['active_listening','powerful_questions','goal_alignment','action_clarity','assumption_challenging'],
    ARRAY['pharma','performance_growth'], NULL, true, v_admin_id
  ),
  (
    'Kilit Doktor Kaybı: Toparlanma ve Strateji',
    'Selin''in en önemli reçeteçilerinden biri geçen hafta ziyareti yarıda keserek artık ilaç firmalarıyla görüşmeyeceğini söyledi. Selin bunu hem kişisel hem profesyonel bir kayıp olarak yaşıyor. Bu görüşmede önce duygusal desteği sağlamalı, ardından Selin''in perspektifini genişleterek stratejik ilerleme planı oluşturmasına yardımcı olmalısın. Çözüme çok erken geçme.',
    'Kırılgan ama performansını koruma konusunda kararlısın. Bu durumu kişisel olarak algıladın; "belki yeterince iyi değildim" düşüncesi var. İlk konuşmalarda duygusal, zamanla analitik olmak istiyorsun. Yönetici seni çok erken "çözüm moduna" geçirmeye çalışırsa kapanıyorsun. Önce dinlenilip anlaşıldığını hissedersen açılıyorsun ve kendi çözümlerini üretmeye başlıyorsun. Seanstaki rolün: ilaç mümessili Selin, yöneticinin koçluk görüşmesinde.',
    v_selin_id, v_rubric_id,
    ARRAY['empathy','active_listening','summarizing']::rubric_dimension_code[],
    ARRAY['silence_management','action_clarity']::rubric_dimension_code[],
    3, 3, 15,
    ARRAY['empathy','active_listening','summarizing','action_clarity','silence_management'],
    ARRAY['pharma','resilience'], NULL, true, v_admin_id
  ),
  (
    'Klinik Diyalog Kalitesi: Soru Sormak Kadar Dinlemek',
    'Selin doktor ziyaretlerinde ürün özelliklerini kapsamlı anlatıyor ancak doktoru yeterince dinlemiyor. Ziyaretler tek yönlü bilgi transferine dönüşüyor; doktorun klinik kaygılarına ve bireysel ihtiyaçlarına girilemiyor. Bu görüşmede davranışsal gözlemlerini yargılamadan paylaşmalı ve Selin''i daha dinleyici, soru odaklı bir ziyaret yaklaşımına yönlendirmelisin.',
    'Teknik bilgine güveniyorsun ve bu güven ziyaretlerde kendini fazla konuşturmanı sağlıyor. Soru sormaktan çekiniyorsun çünkü "yanlış soru sorarım, doktor beni bilgisiz sanır" korkusu var. Yönetici somut davranışsal gözlemler paylaşırsa başta biraz şaşırıyorsun ama savunmacı olmuyorsun. Farkındalık oluştukça kendi yaklaşımını sorgulamaya başlıyorsun ve pratik denemeler yapmaya istekli oluyorsun. Seanstaki rolün: ilaç mümessili Selin, yöneticinin koçluk görüşmesinde.',
    v_selin_id, v_rubric_id,
    ARRAY['active_listening','powerful_questions','non_judgmental']::rubric_dimension_code[],
    ARRAY['feedback_quality','reframing','assumption_challenging']::rubric_dimension_code[],
    2, 2, 15,
    ARRAY['feedback_quality','active_listening','powerful_questions','assumption_challenging','reframing'],
    ARRAY['pharma','communication_skills'], NULL, true, v_admin_id
  ),

  -- ── AHMET ──────────────────────────────────────────────────────────
  (
    'İlk Saha Haftası: Gerçeklik Şoku',
    'Ahmet eğitimini tamamlayıp ilk bağımsız saha haftasından döndü. Doktorların onu ciddi almamasından, bazı sekreterlerin engellemesinden ve ziyaret akışını yönetmekte zorlandığından bahsetti. Motivasyonu sarsılmış. Bu görüşmede önce onu dinlemeli ve duygusal olarak onaylamalı; ardından deneyimlerini öğrenmeye dönüştürmesine yardımcı olmalısın. Hazır cevap değil, koçluk kılavuzlu keşif içermeli.',
    'Hayal kırıklığı yaşıyorsun ama pes etmemişsin; öğrenmeye istekli bir özün var. Kendine güvenin sarsılmış ve yargılanmaktan korkuyorsun. Yönetici seni dinleyip deneyimini normalleştirirse açılıyorsun. Hazır cevap verilirse "tamam" diyorsun ama içselleştirmiyorsun. Güçlü sorularla kendi keşfine yönlendirildiğinde heyecanlanıyorsun ve kendi çözümlerini üretmek istiyorsun. Seanstaki rolün: ilaç tanıtım mümessili Ahmet, yöneticinin koçluk görüşmesinde.',
    v_ahmet_id, v_rubric_id,
    ARRAY['empathy','active_listening','action_clarity']::rubric_dimension_code[],
    ARRAY['summarizing','responsibility_opening']::rubric_dimension_code[],
    1, 1, 15,
    ARRAY['empathy','active_listening','summarizing','action_clarity','responsibility_opening'],
    ARRAY['pharma','onboarding'], NULL, true, v_admin_id
  ),
  (
    'Red ile Başa Çıkma: Doktor Kapısında Gönderilmek',
    'Ahmet geçen hafta saygın bir kardiyoloji uzmanı tarafından koridorda sert bir şekilde gönderildi. "Sizi görmek için zamanım yok" diyen doktor, randevu bile almadan geri çevirdi. Bu deneyim Ahmet''i derinden sarstı ve meslek seçimiyle ilgili şüpheler başladı. Bu görüşmede deneyimi birlikte işlemeli, yeniden anlamlandırmasına yardımcı olmalı ve bir dahaki sefere somut hazırlık yapmasını sağlamalısın.',
    'Hem öfkeli hem kırılgansın. Durumu kişiselleştirdin; "belki bu meslek benim için değil" düşüncesi aklından geçiyor. Çok erken pratik tavsiye verilirse konuşmayı kapatıyorsun. Yönetici seni dinler, duyguları onaylarsa güven oluşuyor ve deneyimi öğrenmeye çevirmeye hazır oluyorsun. Reframing yapıldığında enerji kazanıyorsun. Seanstaki rolün: ilaç tanıtım mümessili Ahmet, yöneticinin koçluk görüşmesinde.',
    v_ahmet_id, v_rubric_id,
    ARRAY['empathy','active_listening','action_clarity']::rubric_dimension_code[],
    ARRAY['reframing','assumption_challenging']::rubric_dimension_code[],
    2, 2, 15,
    ARRAY['empathy','reframing','active_listening','assumption_challenging','action_clarity'],
    ARRAY['pharma','resilience','onboarding'], NULL, true, v_admin_id
  ),
  (
    'Zaman ve Bölge Yönetimi: Dağınık Rutinden Sisteme',
    'Ahmet günlük ziyaret planını verimli oluşturamıyor. Coğrafi olarak dağınık rotalar çiziyor, bazı doktorları sık ziyaret ediyor bazılarını hiç görmüyor; günün büyük kısmı bekleme odalarında geçiyor. Bu görüşmede Ahmet''i hazır reçete vermeden, güçlü sorularla kendi çalışma düzenini analiz etmeye ve kendi sistematik yaklaşımını oluşturmaya yönlendirmelisin.',
    'Planlama konusunda ne yapacağını bilmiyorsun ama yardım istemeye çekiniyorsun; "kendi çözmeliyim, zaten yeniyim" düşüncesi var. Başta biraz savunmacısın. Ancak yönetici yargılamadan merak ederek sorularını sorarsa ve kendi çözümlerini keşfetmene alan açarsa hızla açılıyorsun. Somut bir sistem önerisi kabul ediyorsun ama dışarıdan dayatılırsa direniyorsun, kendi içinden çıkarsa benimsiyorsun. Seanstaki rolün: ilaç tanıtım mümessili Ahmet, yöneticinin koçluk görüşmesinde.',
    v_ahmet_id, v_rubric_id,
    ARRAY['active_listening','powerful_questions','action_clarity']::rubric_dimension_code[],
    ARRAY['goal_alignment','responsibility_opening']::rubric_dimension_code[],
    2, 2, 20,
    ARRAY['action_clarity','goal_alignment','active_listening','powerful_questions','responsibility_opening'],
    ARRAY['pharma','territory_management','onboarding'], NULL, true, v_admin_id
  );

  RAISE NOTICE 'Tamamlandı. Rubric ID: %, Admin ID: %', v_rubric_id, v_admin_id;
END $$;
