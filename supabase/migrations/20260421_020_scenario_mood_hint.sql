-- Migration 020: Persona duygusal durum ipucu (kullanıcıya gösterilen)
-- context_setup AI için talimat içerir; mood_hint kullanıcıya gösterilir.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS mood_hint TEXT;

-- 9 adet seeded senaryoya Türkçe, üçüncü şahıs, empatik ruh hali ipuçları
UPDATE scenarios SET mood_hint =
  'Murat bu görüşmeye temkinli giriyor. Performans düşüşünü kabul ediyor, ancak nedeni olarak hep dış faktörleri gösteriyor. Kendi payını fark etmesini kolaylaştırmak için güvenli ve meraklı bir alan gerekiyor.'
WHERE title = 'Plato Kırma: Deneyimli Yolların Sorgulanması';

UPDATE scenarios SET mood_hint =
  'Murat yıllarca çalıştığı yöntemin güvenliğine sıkışmış. Yeni yaklaşımı teorik buluyor — ama derininde belirsizlikten ve başarısız olmaktan çekiniyor. Empati ve güven bu görüşmenin anahtarı.'
WHERE title = 'Yeni Ürün, Eski Alışkanlıklar';

UPDATE scenarios SET mood_hint =
  'Murat yaptığını "gerçekçi olmak" olarak görüyor ve durumu hafife alıyor. Başta savunmacı; ama yargılanmadan dinlenildiğinde ekibine karşı taşıdığı değerlere ulaşmak mümkün.'
WHERE title = 'Takıma Etki: Kıdemli Çalışanın Sorumluluğu';

UPDATE scenarios SET mood_hint =
  'Selin başarılarını küçümsüyor. A sınıfı doktorlar ona ulaşılamaz geliyor — aslında reddedilmekten kaçınıyor. Kendi gücünü görmesine yardımcı olunduğunda güçlü hedefler belirleyebiliyor.'
WHERE title = 'Bir Sonraki Seviyeye Geçiş: A Sınıfı Hesaplar';

UPDATE scenarios SET mood_hint =
  'Selin bu kaybı hem mesleki hem kişisel olarak yaşadı. Şu an hassas — önce dinlenilmeye ve anlaşılmaya ihtiyaç duyuyor. Çok erken çözüm önerilirse kapanıyor.'
WHERE title = 'Kilit Doktor Kaybı: Toparlanma ve Strateji';

UPDATE scenarios SET mood_hint =
  'Selin teknik bilgisine güveniyor, ama bu ziyaretleri monologa dönüştürüyor. "Yanlış soru sorarım" korkusu onu dinleme yerine anlatmaya itiyor. Somut gözlemler paylaşıldığında açık ve meraklı yanıt veriyor.'
WHERE title = 'Klinik Diyalog Kalitesi: Soru Sormak Kadar Dinlemek';

UPDATE scenarios SET mood_hint =
  'Ahmet ilk saha haftasının ağırlığını taşıyor — motivasyonu sarsılmış ama pes etmemiş. Yargılanmaktan çekiniyor; deneyimlerini normalleştiren ve keşfetme alanı açan bir yaklaşım ona güç veriyor.'
WHERE title = 'İlk Saha Haftası: Gerçeklik Şoku';

UPDATE scenarios SET mood_hint =
  'Ahmet sert bir reddedilmeyi derinden kişiselleştirdi. "Belki bu meslek benim için değil" düşüncesiyle boğuşuyor. Pratik tavsiyeden önce duygularının onaylanması gerekiyor.'
WHERE title = 'Red ile Başa Çıkma: Doktor Kapısında Gönderilmek';

UPDATE scenarios SET mood_hint =
  'Ahmet sistemsiz çalıştığının farkında, ama çözümü kendisi bulması gerektiğini düşünerek yardım istemekten çekiniyor. Dışarıdan dayatılan çözümlere direnç gösteriyor — kendi içinden çıkan çözümleri hızla benimsiyor.'
WHERE title = 'Zaman ve Bölge Yönetimi: Dağınık Rutinden Sisteme';
