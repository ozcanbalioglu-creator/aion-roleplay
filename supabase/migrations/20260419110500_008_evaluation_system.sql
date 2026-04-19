-- ─── Evaluations ─────────────────────────────────────────────────────────────
-- Her tamamlanan seans için bir değerlendirme (async oluşturulur)
CREATE TABLE evaluations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID        NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL REFERENCES users(id),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id),
  rubric_template_id   UUID        NOT NULL REFERENCES rubric_templates(id),
  -- Tüm boyutların ağırlıklı ortalaması (0.0 - 5.0)
  overall_score        NUMERIC(3,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 5),
  -- Kullanılan prompt versiyonu (izlenebilirlik)
  eval_prompt_version_id UUID      REFERENCES prompt_versions(id),
  -- LLM'in ürettiği güçlü yönler listesi
  strengths            TEXT[]      NOT NULL DEFAULT '{}',
  -- Gelişim alanları listesi
  development_areas    TEXT[]      NOT NULL DEFAULT '{}',
  -- Kullanıcıya koçluk notu (LLM üretir)
  coaching_note        TEXT        NOT NULL DEFAULT '',
  -- Manager içgörüsü (manager_insights prompt'u ile üretilir)
  manager_insight      TEXT        DEFAULT NULL,
  -- İşlem durumu
  status               TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX idx_evaluations_tenant_id ON evaluations(tenant_id);
CREATE INDEX idx_evaluations_session_id ON evaluations(session_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
CREATE INDEX idx_evaluations_created_at ON evaluations(created_at DESC);

CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Dimension Scores ────────────────────────────────────────────────────────
-- Her rubric boyutu için ayrı skor kaydı
CREATE TABLE dimension_scores (
  id               UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id    UUID                  NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  dimension_code   rubric_dimension_code NOT NULL,
  score            SMALLINT              NOT NULL CHECK (score BETWEEN 1 AND 5),
  -- Transkriptten alınan kanıt alıntıları (max 3)
  evidence_quotes  TEXT[]                NOT NULL DEFAULT '{}',
  -- Puanın gerekçesi
  rationale        TEXT                  NOT NULL DEFAULT '',
  -- Gelişim önerisi
  improvement_tip  TEXT                  NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ           NOT NULL DEFAULT now()
);

CREATE INDEX idx_dimension_scores_evaluation_id ON dimension_scores(evaluation_id);
CREATE UNIQUE INDEX idx_dimension_scores_unique
  ON dimension_scores(evaluation_id, dimension_code);