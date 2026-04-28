-- Fix: persona_tenant_mapping RLS policies were using auth.jwt() ->> 'role'
-- but role is stored under user_metadata, not the JWT root.
-- Replace with is_super_admin() and auth_tenant_id() helpers (same as all other tables).

DROP POLICY IF EXISTS "super_admin_view_all_mappings"   ON persona_tenant_mapping;
DROP POLICY IF EXISTS "super_admin_manage_mappings"     ON persona_tenant_mapping;
DROP POLICY IF EXISTS "super_admin_update_mappings"     ON persona_tenant_mapping;
DROP POLICY IF EXISTS "super_admin_delete_mappings"     ON persona_tenant_mapping;
DROP POLICY IF EXISTS "tenant_admin_view_own_mappings"  ON persona_tenant_mapping;
DROP POLICY IF EXISTS "super_admin_all_mappings"        ON persona_tenant_mapping;

CREATE POLICY "super_admin_all_mappings"
  ON persona_tenant_mapping FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "tenant_admin_view_own_mappings"
  ON persona_tenant_mapping FOR SELECT
  USING (
    auth_role() = 'tenant_admin'
    AND tenant_id = auth_tenant_id()
  );
