-- ─── RLS Etkinleştirme ───────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- ─── Helper function: JWT'den tenant_id al ───────────────────────────────────
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Helper function: JWT'den role al ───────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'user_metadata' ->> 'role';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Helper function: Süper admin mi? ────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT auth_role() = 'super_admin';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Tenants RLS ─────────────────────────────────────────────────────────────
-- Super admin: hepsini görür
CREATE POLICY "super_admin_all_tenants"
  ON tenants FOR ALL
  USING (is_super_admin());

-- Diğerleri: sadece kendi tenant'ını görür
CREATE POLICY "tenant_member_own_tenant"
  ON tenants FOR SELECT
  USING (id = auth_tenant_id() AND NOT is_super_admin());

-- ─── Users RLS ───────────────────────────────────────────────────────────────
-- Super admin: hepsini görür ve yönetir
CREATE POLICY "super_admin_all_users"
  ON users FOR ALL
  USING (is_super_admin());

-- Tenant admin ve HR: kendi tenant'ının kullanıcılarını görür
CREATE POLICY "tenant_admin_own_users"
  ON users FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'hr_admin')
    AND NOT is_super_admin()
  );

-- Manager: kendi tenant kullanıcılarını görür (ekip için)
CREATE POLICY "manager_own_tenant_users"
  ON users FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'manager'
  );

-- Kullanıcı: sadece kendi profilini görür
CREATE POLICY "user_own_profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Kullanıcı: sadece kendi profilini güncelleyebilir (avatar, full_name)
CREATE POLICY "user_update_own_profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- rol ve tenant_id değiştirilemez
    AND role = (SELECT role FROM users WHERE id = auth.uid())
    AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- ─── Consent Records RLS ─────────────────────────────────────────────────────
-- Super admin: hepsini görür
CREATE POLICY "super_admin_all_consents"
  ON consent_records FOR ALL
  USING (is_super_admin());

-- Kullanıcı: sadece kendi onayını ekler ve görür
CREATE POLICY "user_own_consent"
  ON consent_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_consent"
  ON consent_records FOR INSERT
  WITH CHECK (user_id = auth.uid());
