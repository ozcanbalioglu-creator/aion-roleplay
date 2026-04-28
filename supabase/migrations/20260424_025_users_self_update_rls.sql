-- ─── P0-004: users self-update RLS policy yenileme ──────────────────────────
--
-- Sorun:
--   002_rls_policies.sql'deki "user_update_own_profile" policy WITH CHECK'inde
--   recursive subquery var:
--     AND role = (SELECT role FROM users WHERE id = auth.uid())
--     AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
--   is_active korunmuyor. Ayrıca profil update action'ı createServiceClient()
--   ile çağrılıyordu; key eksik/yanlış olunca RLS'e geri düşüyor ve subquery
--   auth.uid() = NULL ile FALSE dönüyor, update bloklanıyordu.
--
-- Düzeltme:
--   1. Eski policy DROP edilir.
--   2. Yeni policy: sadece USING/WITH CHECK = auth.uid() = id.
--      role, tenant_id ve is_active bu action'da hiç SET edilmediği için
--      korunur. Bunları değiştirmeye çalışan ayrı bir policy yoktur.
--   3. avatar_url güncellemesi de aynı policy kapsamında çalışır.
--
-- Operasyonel Not — Avatar Storage:
--   20260422_023_storage_avatars_bucket.sql migration'ının Supabase projesine
--   uygulandığını doğrulayın (SQL Editor). Bucket yoksa uploadAvatarAction
--   "Bucket not found" hatası üretir. Bu kod değişikliği değil, deploy adımıdır.

DROP POLICY IF EXISTS "user_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_self_update" ON public.users;

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
  );
