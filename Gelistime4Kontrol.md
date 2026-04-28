# 1 Tenant - Gamification

Rozet ve Haftalık Görev için oluşturulan görevleri Tenant olarak istendiğinde değiştirebilmeli, pasif duruma getirebilmeli, silebilmeli.

Kontrol sonrası: Güncelleme yapılamıyor; Pasif duruma getirildiği bilgisi geldi ancak gerçekten pasif olup olmadığı belli değil; Silmek için çöp kutusu ikona tıkladım, önce onay istedi, onayladıktan sonra aynı rozet yine ekranda duruyordu, hatta tekarar pasif duruma gelmesi için düğme de açık.

# 2 Profil güncelleme

Önce fotoğraf yüklemek istedim, "Fotoğraf yüklenemedi: Bucket not found" hatası verdi.
Sonra input alanlarını güncellemek istedim, bu defa "Profil güncellenemedi." hatası gösterdi.

Kontrol sonrası: (Tenant Admin Profili için) Profil Fotoğraf yüklemek istediğimde yyüklenebiliyor.
İnput alanları denendi, değişiklik oluyor.

# 3 Seans tasarımı

dikkat edersen verdiğim görsellerde ana ekran içinde gömülü her şey. <div class="flex-1 flex flex-col"> içinde doğrudan girilmeli. Şu an mevcut durumda ise <div class="flex overflow-hidden rounded-2xl shadow-2xl border border-white/5" style="min-height: 700px;"> içinde duruyor.
Yani istediğim şey içerik, görsel vs.. alanın içini tam kaplasın.

Kontrol sonrası: Evet, istediğim ekrana çok benziyor, bu şekilde de kullanılabilir.

# 4 Seans tasarım - Foto

Ortada persona isminin baş harfi yerine, fotoğrafının olmasını istiyoum.

Kontrol sonrası: Evet, istediğim gibi persona fotoğrafı olmuş
---
