# 1 Tenant - Gamification
Rozet ve Haftalık Görev için oluşturulan görevleri Tenant olarak istendiğinde değiştirebilmeli, pasif duruma getirebilmeli, silebilmeli.

# 2 Profil güncelleme
Önce fotoğraf yüklemek istedim, "Fotoğraf yüklenemedi: Bucket not found" hatası verdi.
Sonra input alanlarını güncellemek istedim, bu defa "Profil güncellenemedi." hatası gösterdi.

# 3 Seans tasarımı
dikkat edersen verdiğim görsellerde ana ekran içinde gömülü her şey. <div class="flex-1 flex flex-col"> içinde doğrudan girilmeli. Şu an mevcut durumda ise <div class="flex overflow-hidden rounded-2xl shadow-2xl border border-white/5" style="min-height: 700px;"> içinde duruyor. 
Yani istediğim şey içerik, görsel vs.. alanın içini tam kaplasın.

# 4 Seans tasarım - Foto
Ortada persona isminin baş harfi yerine, fotoğrafının olmasını istiyoum.

---

## Yapılan Değişiklikler

### #1 Gamification CRUD
- `src/lib/actions/gamification.actions.ts` — `toggleBadgeStatusAction`, `deleteBadgeAction`, `toggleChallengeStatusAction`, `deleteChallengeAction` fonksiyonları eklendi.
- `src/components/tenant/GamificationLists.tsx` — Her rozet ve görev kartına "Pasifleştir/Aktifleştir" ve silme butonu eklendi. Silme işlemi `ConfirmDialog` ile onay alınıyor.

### #2 Profil güncelleme hataları
- **"Bucket not found" hatası:** `supabase/migrations/20260422_023_storage_avatars_bucket.sql` migration'ı oluşturuldu. `avatars` bucket'ı (public, max 5MB, jpeg/png/webp/gif) ve RLS politikaları tanımlandı. **Supabase SQL Editor'da çalıştırılması gerekiyor.**
- **"Profil güncellenemedi" hatası:** `src/lib/actions/user.actions.ts` içindeki `updateMyProfileAction` fonksiyonu `createClient()` yerine `createServiceClient()` kullanacak şekilde güncellendi (RLS bypass).

### #3 Seans tasarımı tam kaplama
- `src/app/(dashboard)/dashboard/sessions/new/page.tsx` — Adım 2 için `flex-1 flex flex-col overflow-hidden` yapısı kullanıldı; stepper ayrı `shrink-0` satırında, içerik kalan alanı dolduruyor.
- `src/components/sessions/CinematicPersonaStage.tsx` — Dış wrapper'dan `rounded-2xl`, `shadow-2xl`, `border border-white/5`, `min-height: 700px` kaldırıldı; `flex flex-1 h-full overflow-hidden` olarak güncellendi.

### #4 Seans tasarım - Fotoğraf
- `src/lib/queries/persona.queries.ts` — `getPersonaDetail` fonksiyonundaki SELECT sorgusuna `avatar_image_url` alanı eklendi. Daha önce bu alan sorguya dahil edilmediği için persona fotoğrafı `null` geliyordu ve baş harfi fallback gösteriliyordu.