-- ─── Scenarios ───────────────────────────────────────────────────────────────
CREATE TABLE scenarios (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT        NOT NULL,
  description           TEXT        NOT NULL,
  persona_id            UUID        NOT NULL REFERENCES personas(id) ON DELETE RESTRICT,
  rubric_template_id    UUID        NOT NULL REFERENCES rubric_templates(id),
  -- Hangi rubric boyutlarının bu senaryo için öncelikli olduğu
  target_dimension_codes rubric_dimension_code[] NOT NULL DEFAULT '{}',
  -- Seçmeli boyutlar (tenant veya senaryo bazında 2-4 seçilir)
  optional_dimension_codes rubric_dimension_code[] NOT NULL DEFAULT '{}',
  difficulty            SMALLINT    NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  sector_tags           TEXT[]      NOT NULL DEFAULT '{}',
  -- NULL = global (tüm tenant'lar), dolu = sadece o tenant
  tenant_id             UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  estimated_duration_min SMALLINT   DEFAULT 15,
  created_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenarios_persona_id ON scenarios(persona_id);
CREATE INDEX idx_scenarios_tenant_id ON scenarios(tenant_id);
CREATE INDEX idx_scenarios_is_active ON scenarios(is_active);
CREATE INDEX idx_scenarios_difficulty ON scenarios(difficulty);

CREATE TRIGGER scenarios_updated_at
  BEFORE UPDATE ON scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();