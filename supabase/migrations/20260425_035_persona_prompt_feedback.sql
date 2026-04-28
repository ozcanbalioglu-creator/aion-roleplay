-- persona_prompt_feedback: Super admin prompt iyileştirme notları
CREATE TABLE IF NOT EXISTS persona_prompt_feedback (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id            UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  scenario_id           UUID        REFERENCES scenarios(id) ON DELETE SET NULL,
  session_id            UUID        REFERENCES sessions(id) ON DELETE SET NULL,
  super_admin_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_text         TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open', 'applied', 'dismissed')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS persona_prompt_feedback_persona_id_idx
  ON persona_prompt_feedback(persona_id);
CREATE INDEX IF NOT EXISTS persona_prompt_feedback_session_id_idx
  ON persona_prompt_feedback(session_id);
CREATE INDEX IF NOT EXISTS persona_prompt_feedback_created_at_idx
  ON persona_prompt_feedback(created_at DESC);

ALTER TABLE persona_prompt_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_persona_prompt_feedback" ON persona_prompt_feedback;
CREATE POLICY "super_admin_all_persona_prompt_feedback" ON persona_prompt_feedback
  FOR ALL TO authenticated
  USING   (is_super_admin())
  WITH CHECK (is_super_admin());
