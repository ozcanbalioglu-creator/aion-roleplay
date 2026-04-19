-- ─── Rubric boyut kod enum'u ─────────────────────────────────────────────────
CREATE TYPE rubric_dimension_code AS ENUM (
  -- Sabit boyutlar (her seansda zorunlu)
  'active_listening',
  'powerful_questions',
  'summarizing',
  'empathy',
  'action_clarity',
  'non_judgmental',
  -- Seçmeli boyutlar (havuzdan seçilir)
  'assumption_challenging',
  'responsibility_opening',
  'goal_alignment',
  'feedback_quality',
  'silence_management',
  'reframing'
);

-- ─── Rubric Templates ────────────────────────────────────────────────────────
-- İsimlendirilmiş rubric seti (örn: "Standard ICF v1")
CREATE TABLE rubric_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  description  TEXT,
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rubric_templates_default
  ON rubric_templates(is_default)
  WHERE is_default = true;

-- ─── Rubric Dimensions ───────────────────────────────────────────────────────
-- Bir rubric template'indeki boyutlar
CREATE TABLE rubric_dimensions (
  id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID                  NOT NULL REFERENCES rubric_templates(id) ON DELETE CASCADE,
  dimension_code  rubric_dimension_code NOT NULL,
  is_required     BOOLEAN               NOT NULL DEFAULT false,
  -- Puanlama için davranış göstergeleri (1-5 her biri için)
  score_labels    JSONB                 NOT NULL DEFAULT '{}',
  -- Örn: {"1": "Davranış neredeyse yok", "3": "Kısmen var", "5": "Güçlü ve doğal"}
  sort_order      SMALLINT              NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ           NOT NULL DEFAULT now()
);

CREATE INDEX idx_rubric_dimensions_template ON rubric_dimensions(template_id);
CREATE UNIQUE INDEX idx_rubric_dimensions_unique
  ON rubric_dimensions(template_id, dimension_code);