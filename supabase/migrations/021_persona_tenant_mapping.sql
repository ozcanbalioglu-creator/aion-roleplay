-- ─── Persona-Tenant Mapping (Super Admin Kararında Hangi Persona Hangi Tenant'ta) ───

CREATE TABLE persona_tenant_mapping (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Aynı persona-tenant kombinasyonu bir kere
  UNIQUE(persona_id, tenant_id)
);

CREATE INDEX idx_persona_tenant_mapping_persona ON persona_tenant_mapping(persona_id);
CREATE INDEX idx_persona_tenant_mapping_tenant ON persona_tenant_mapping(tenant_id);
CREATE INDEX idx_persona_tenant_mapping_active ON persona_tenant_mapping(is_active);

-- ─── Update Trigger for persona_tenant_mapping ──────────────────────────────
CREATE TRIGGER persona_tenant_mapping_updated_at
  BEFORE UPDATE ON persona_tenant_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS: Persona-Tenant Mapping Politikaları ──────────────────────────────

-- Super Admin hepsini görebilir
CREATE POLICY "super_admin_view_all_mappings"
ON persona_tenant_mapping FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'super_admin'
);

-- Super Admin insert/update/delete yapabilir
CREATE POLICY "super_admin_manage_mappings"
ON persona_tenant_mapping FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'role' = 'super_admin'
);

CREATE POLICY "super_admin_update_mappings"
ON persona_tenant_mapping FOR UPDATE
USING (auth.jwt() ->> 'role' = 'super_admin')
WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "super_admin_delete_mappings"
ON persona_tenant_mapping FOR DELETE
USING (auth.jwt() ->> 'role' = 'super_admin');

-- Tenant Admin, kendi tenant'ında eşlenmiş personaları görebilir (read-only)
CREATE POLICY "tenant_admin_view_own_mappings"
ON persona_tenant_mapping FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'tenant_admin'
  AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- ─── View: Tenant İçin Erişilebilir Personalar ──────────────────────────────
CREATE OR REPLACE VIEW tenant_available_personas AS
SELECT DISTINCT
  p.id,
  p.name,
  p.surname,
  p.title,
  p.difficulty,
  p.personality_type,
  p.emotional_baseline,
  p.is_active,
  p.avatar_image_url,
  ptm.tenant_id,
  ptm.assigned_at
FROM personas p
INNER JOIN persona_tenant_mapping ptm ON p.id = ptm.persona_id
WHERE ptm.is_active = true AND p.is_active = true
ORDER BY ptm.assigned_at DESC;

ALTER TABLE persona_tenant_mapping ENABLE ROW LEVEL SECURITY;
