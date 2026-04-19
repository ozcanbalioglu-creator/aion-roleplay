-- ─── Prompt tip enum'u ───────────────────────────────────────────────────────
CREATE TYPE prompt_type AS ENUM (
  'role_play_system',
  'session_summary',
  'evaluation_extraction',
  'evaluation_scoring',
  'feedback_coaching',
  'manager_insights'
);

-- ─── Prompt Templates ────────────────────────────────────────────────────────
-- Global prompt şablonları (Super Admin yönetir)
CREATE TABLE prompt_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  prompt_type  prompt_type NOT NULL,
  description  TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_templates_type ON prompt_templates(prompt_type);
CREATE UNIQUE INDEX idx_prompt_templates_name ON prompt_templates(name);

CREATE TRIGGER prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Prompt Versions ─────────────────────────────────────────────────────────
CREATE TABLE prompt_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID        NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version_number  INTEGER     NOT NULL,
  content         TEXT        NOT NULL,
  -- Prompt içinde kullanılan {{değişken}} adları
  variables       TEXT[]      NOT NULL DEFAULT '{}',
  -- Hangi model + parametrelerle test edildi
  tested_with     JSONB       DEFAULT '{}',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_versions_template_id ON prompt_versions(template_id);
CREATE INDEX idx_prompt_versions_is_active ON prompt_versions(is_active);
CREATE UNIQUE INDEX idx_prompt_versions_unique
  ON prompt_versions(template_id, version_number);

-- Bir template'in yalnızca bir active version'ı olabilir
CREATE UNIQUE INDEX idx_prompt_versions_one_active
  ON prompt_versions(template_id)
  WHERE is_active = true;