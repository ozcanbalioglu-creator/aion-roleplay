-- P0-002: badges şema birleşimi — badge_code dualizmi giderildi
-- Idempotent: Supabase SQL Editor'a güvenle yapıştırılabilir.

-- 1. badge_code kolonu varsa code'a kopyala, sonra kaldır
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badges' AND column_name = 'badge_code'
  ) THEN
    UPDATE badges SET code = badge_code WHERE code IS NULL AND badge_code IS NOT NULL;
    DROP INDEX IF EXISTS idx_badges_badge_code;
    ALTER TABLE badges DROP COLUMN badge_code;
  END IF;
END $$;

-- 4. code kolonunu NOT NULL yap (önce NULL olanları fallback değerle doldur)
UPDATE badges SET code = 'legacy_' || id::text WHERE code IS NULL;
ALTER TABLE badges ALTER COLUMN code SET NOT NULL;

-- 5. Tenant-özgü rozetler için unique index: (tenant_id, code) kombinasyonu
DROP INDEX IF EXISTS idx_badges_code_tenant;
CREATE UNIQUE INDEX idx_badges_code_tenant ON badges (tenant_id, code) WHERE tenant_id IS NOT NULL;

-- 6. Global rozetler için unique index: sadece code
DROP INDEX IF EXISTS idx_badges_code_global;
CREATE UNIQUE INDEX idx_badges_code_global ON badges (code) WHERE tenant_id IS NULL;

-- 7. badges UPDATE policy
DROP POLICY IF EXISTS "badges_tenant_update" ON badges;
CREATE POLICY "badges_tenant_update" ON badges
  FOR UPDATE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- 8. badges DELETE policy
DROP POLICY IF EXISTS "badges_tenant_delete" ON badges;
CREATE POLICY "badges_tenant_delete" ON badges
  FOR DELETE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- 9. challenges UPDATE policy
DROP POLICY IF EXISTS "challenges_tenant_update" ON challenges;
CREATE POLICY "challenges_tenant_update" ON challenges
  FOR UPDATE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- 10. challenges DELETE policy
DROP POLICY IF EXISTS "challenges_tenant_delete" ON challenges;
CREATE POLICY "challenges_tenant_delete" ON challenges
  FOR DELETE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- 11. Super admin global rozetleri yönetebilir
DROP POLICY IF EXISTS "badges_superadmin_update" ON badges;
CREATE POLICY "badges_superadmin_update" ON badges
  FOR UPDATE USING (tenant_id IS NULL AND auth_role() = 'super_admin');

DROP POLICY IF EXISTS "badges_superadmin_delete" ON badges;
CREATE POLICY "badges_superadmin_delete" ON badges
  FOR DELETE USING (tenant_id IS NULL AND auth_role() = 'super_admin');

DROP POLICY IF EXISTS "challenges_superadmin_update" ON challenges;
CREATE POLICY "challenges_superadmin_update" ON challenges
  FOR UPDATE USING (tenant_id IS NULL AND auth_role() = 'super_admin');

DROP POLICY IF EXISTS "challenges_superadmin_delete" ON challenges;
CREATE POLICY "challenges_superadmin_delete" ON challenges
  FOR DELETE USING (tenant_id IS NULL AND auth_role() = 'super_admin');
