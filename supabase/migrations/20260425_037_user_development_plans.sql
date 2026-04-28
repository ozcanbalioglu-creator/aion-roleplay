-- user_development_plans: Son 5 seans bazlı gelişim önerileri
CREATE TABLE IF NOT EXISTS user_development_plans (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id                 UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sessions_considered       UUID[]      NOT NULL DEFAULT '{}',
  top_strengths             TEXT[]      NOT NULL DEFAULT '{}',
  priority_development_areas TEXT[]     NOT NULL DEFAULT '{}',
  training_recommendations  JSONB       NOT NULL DEFAULT '[]',
  book_recommendations      JSONB       NOT NULL DEFAULT '[]',
  coach_note                TEXT,
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS user_development_plans_user_id_idx
  ON user_development_plans(user_id);
CREATE INDEX IF NOT EXISTS user_development_plans_tenant_id_idx
  ON user_development_plans(tenant_id);
CREATE INDEX IF NOT EXISTS user_development_plans_expires_at_idx
  ON user_development_plans(expires_at DESC);

ALTER TABLE user_development_plans ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi planını görür
DROP POLICY IF EXISTS "dev_plan_own" ON user_development_plans;
CREATE POLICY "dev_plan_own" ON user_development_plans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tenant yöneticileri aynı tenant kullanıcılarının planını görür
DROP POLICY IF EXISTS "dev_plan_tenant_viewers" ON user_development_plans;
CREATE POLICY "dev_plan_tenant_viewers" ON user_development_plans
  FOR SELECT TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'hr_admin', 'hr_viewer', 'manager')
  );

-- Super admin: tümü
DROP POLICY IF EXISTS "dev_plan_super_admin" ON user_development_plans;
CREATE POLICY "dev_plan_super_admin" ON user_development_plans
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
