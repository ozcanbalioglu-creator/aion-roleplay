-- ─── RLS Etkinleştirme ───────────────────────────────────────────────────────
ALTER TABLE personas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_kpis            ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_dimensions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimension_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests  ENABLE ROW LEVEL SECURITY;

-- ─── PERSONAS: Herkese açık okuma (global), sadece super_admin yazar ─────────
CREATE POLICY "personas_read_all"
  ON personas FOR SELECT
  USING (
    is_active = true AND (
      tenant_id IS NULL OR       -- Global persona
      tenant_id = auth_tenant_id()  -- Tenant-specific
    )
  );

CREATE POLICY "personas_super_admin_all"
  ON personas FOR ALL USING (is_super_admin());

-- ─── PERSONA_KPIS: Persona erişimi ile aynı kural ────────────────────────────
CREATE POLICY "persona_kpis_read"
  ON persona_kpis FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM personas p WHERE p.id = persona_id
      AND (p.tenant_id IS NULL OR p.tenant_id = auth_tenant_id())
  ));

CREATE POLICY "persona_kpis_super_admin_all"
  ON persona_kpis FOR ALL USING (is_super_admin());

-- ─── PERSONA_PROMPT_VERSIONS: Sadece super_admin okur ────────────────────────
CREATE POLICY "persona_prompts_super_admin_only"
  ON persona_prompt_versions FOR ALL USING (is_super_admin());

-- ─── PROMPT_TEMPLATES: Okuma herkese, yazma super_admin ──────────────────────
CREATE POLICY "prompt_templates_read"
  ON prompt_templates FOR SELECT USING (is_active = true);

CREATE POLICY "prompt_templates_super_admin_all"
  ON prompt_templates FOR ALL USING (is_super_admin());

-- ─── PROMPT_VERSIONS: Sadece super_admin ─────────────────────────────────────
CREATE POLICY "prompt_versions_super_admin_only"
  ON prompt_versions FOR ALL USING (is_super_admin());

-- ─── RUBRIC: Okuma herkese açık ──────────────────────────────────────────────
CREATE POLICY "rubric_templates_read" ON rubric_templates FOR SELECT USING (is_active = true);
CREATE POLICY "rubric_templates_super_admin" ON rubric_templates FOR ALL USING (is_super_admin());
CREATE POLICY "rubric_dimensions_read" ON rubric_dimensions FOR SELECT USING (true);
CREATE POLICY "rubric_dimensions_super_admin" ON rubric_dimensions FOR ALL USING (is_super_admin());

-- ─── SCENARIOS ────────────────────────────────────────────────────────────────
CREATE POLICY "scenarios_read"
  ON scenarios FOR SELECT
  USING (is_active = true AND (tenant_id IS NULL OR tenant_id = auth_tenant_id()));

CREATE POLICY "scenarios_tenant_admin_write"
  ON scenarios FOR INSERT
  WITH CHECK (
    auth_role() IN ('super_admin', 'tenant_admin')
    AND (tenant_id IS NULL OR tenant_id = auth_tenant_id() OR is_super_admin())
  );

CREATE POLICY "scenarios_super_admin_all"
  ON scenarios FOR ALL USING (is_super_admin());

-- ─── SESSIONS ─────────────────────────────────────────────────────────────────
-- Kullanıcı kendi seanslarını görür
CREATE POLICY "sessions_own"
  ON sessions FOR SELECT USING (user_id = auth.uid());

-- Manager kendi tenant'ının tüm seanslarını görür
CREATE POLICY "sessions_manager_tenant"
  ON sessions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('manager', 'hr_admin', 'tenant_admin', 'super_admin')
  );

-- Kullanıcı kendi seansını başlatır ve günceller
CREATE POLICY "sessions_user_insert"
  ON sessions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = auth_tenant_id());

CREATE POLICY "sessions_user_update"
  ON sessions FOR UPDATE
  USING (user_id = auth.uid());

-- ─── SESSION_MESSAGES: Sadece sistem/evaluation erişir, UI erişemez ────────────
-- Kullanıcı kendi mesajlarını yazar (seans sırasında)
CREATE POLICY "session_messages_user_insert"
  ON session_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

-- Hiçbir rol UI'dan okuyamaz (evaluation motoru service_role ile okur)
-- Bu RLS kasıtlı olarak SELECT politikası tanımlamaz.

-- ─── EVALUATIONS: Kullanıcı kendi değerlendirmesini görür ────────────────────
CREATE POLICY "evaluations_own"
  ON evaluations FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "evaluations_manager"
  ON evaluations FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('manager', 'hr_admin', 'tenant_admin', 'super_admin')
  );

CREATE POLICY "evaluations_system_insert"
  ON evaluations FOR INSERT WITH CHECK (true);  -- Service role ile eklenir

CREATE POLICY "evaluations_system_update"
  ON evaluations FOR UPDATE USING (true);       -- Service role ile güncellenir

-- ─── DIMENSION_SCORES: Evaluation erişimi ile aynı kural ─────────────────────
CREATE POLICY "dimension_scores_via_evaluation"
  ON dimension_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.id = evaluation_id
      AND (e.user_id = auth.uid() OR (
        e.tenant_id = auth_tenant_id()
        AND auth_role() IN ('manager', 'hr_admin', 'tenant_admin', 'super_admin')
      ))
  ));

CREATE POLICY "dimension_scores_system_insert"
  ON dimension_scores FOR INSERT WITH CHECK (true);

-- ─── GAMIFICATION ─────────────────────────────────────────────────────────────
CREATE POLICY "gamification_own"
  ON gamification_profiles FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "gamification_manager"
  ON gamification_profiles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() IN ('manager', 'hr_admin', 'tenant_admin', 'super_admin'));

CREATE POLICY "gamification_system_all"
  ON gamification_profiles FOR ALL USING (true);

CREATE POLICY "user_badges_own" ON user_badges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_badges_system" ON user_badges FOR INSERT WITH CHECK (true);
CREATE POLICY "user_challenges_own" ON user_challenges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_challenges_system" ON user_challenges FOR ALL USING (true);
CREATE POLICY "point_transactions_own" ON point_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "point_transactions_system" ON point_transactions FOR INSERT WITH CHECK (true);

-- ─── OBSERVABILITY ────────────────────────────────────────────────────────────
CREATE POLICY "usage_metrics_own" ON usage_metrics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "usage_metrics_admin" ON usage_metrics FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() IN ('tenant_admin', 'super_admin'));
CREATE POLICY "usage_metrics_system" ON usage_metrics FOR INSERT WITH CHECK (true);

CREATE POLICY "prompt_logs_super_admin" ON prompt_logs FOR ALL USING (is_super_admin());
CREATE POLICY "prompt_logs_system_insert" ON prompt_logs FOR INSERT WITH CHECK (true);

-- ─── ADMIN & COMPLIANCE ───────────────────────────────────────────────────────
CREATE POLICY "audit_logs_tenant_admin"
  ON audit_logs FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() IN ('tenant_admin', 'super_admin'));

CREATE POLICY "audit_logs_system_insert" ON audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_own_update"
  ON notifications FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_system" ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "deletion_requests_own"
  ON data_deletion_requests FOR SELECT USING (user_id = auth.uid() OR requested_by = auth.uid());
CREATE POLICY "deletion_requests_admin"
  ON data_deletion_requests FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_role() IN ('tenant_admin', 'super_admin'));
CREATE POLICY "deletion_requests_user_insert"
  ON data_deletion_requests FOR INSERT WITH CHECK (requested_by = auth.uid());
CREATE POLICY "deletion_requests_admin_update"
  ON data_deletion_requests FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_role() IN ('tenant_admin', 'super_admin'));