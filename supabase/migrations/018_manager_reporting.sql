-- Migration 018: Manager reporting infrastructure

-- Add hr_viewer role for read-only tenant reporting.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'hr_viewer'
      AND enumtypid = 'user_role'::regtype
  ) THEN
    ALTER TYPE user_role ADD VALUE 'hr_viewer';
  END IF;
END $$;

-- Manager relationship on users.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id) WHERE manager_id IS NOT NULL;

-- Tenant settings for reporting preferences.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tenants.settings IS
  'Tenant settings: {"leaderboard_anonymous": false, "weekly_report_enabled": true}';

-- Previous phases allowed managers to read tenant-wide reporting tables.
-- Replace those broad policies so manager reads are scoped by the team policies below.
DROP POLICY IF EXISTS "manager_own_tenant_users" ON users;

DROP POLICY IF EXISTS "sessions_manager_tenant" ON sessions;
CREATE POLICY "sessions_manager_tenant"
  ON sessions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('hr_admin', 'tenant_admin', 'super_admin')
  );

DROP POLICY IF EXISTS "evaluations_manager" ON evaluations;
CREATE POLICY "evaluations_manager"
  ON evaluations FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('hr_admin', 'tenant_admin', 'super_admin')
  );

DROP POLICY IF EXISTS "dimension_scores_via_evaluation" ON dimension_scores;
CREATE POLICY "dimension_scores_via_evaluation"
  ON dimension_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.id = dimension_scores.evaluation_id
      AND (e.user_id = auth.uid() OR (
        e.tenant_id = auth_tenant_id()
        AND auth_role() IN ('hr_admin', 'tenant_admin', 'super_admin')
      ))
  ));

-- ============================================================
-- RLS: evaluations table - manager + hr_viewer read
-- ============================================================

DROP POLICY IF EXISTS "manager_read_team_evaluations" ON evaluations;
CREATE POLICY "manager_read_team_evaluations"
  ON evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = evaluations.user_id
        AND u.manager_id = auth.uid()
        AND u.tenant_id = auth_tenant_id()
    )
  );

DROP POLICY IF EXISTS "hr_viewer_read_evaluations" ON evaluations;
CREATE POLICY "hr_viewer_read_evaluations"
  ON evaluations FOR SELECT
  USING (
    auth_role() = 'hr_viewer'
    AND evaluations.tenant_id = auth_tenant_id()
  );

-- ============================================================
-- RLS: dimension_scores table - manager + hr_viewer read
-- ============================================================

DROP POLICY IF EXISTS "manager_read_team_dimension_scores" ON dimension_scores;
CREATE POLICY "manager_read_team_dimension_scores"
  ON dimension_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      JOIN sessions s ON s.id = e.session_id
      JOIN users u ON u.id = s.user_id
      WHERE e.id = dimension_scores.evaluation_id
        AND u.manager_id = auth.uid()
        AND u.tenant_id = auth_tenant_id()
    )
  );

DROP POLICY IF EXISTS "hr_viewer_read_dimension_scores" ON dimension_scores;
CREATE POLICY "hr_viewer_read_dimension_scores"
  ON dimension_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = dimension_scores.evaluation_id
        AND e.tenant_id = auth_tenant_id()
        AND auth_role() = 'hr_viewer'
    )
  );

-- ============================================================
-- RLS: sessions table - manager + hr_viewer read
-- ============================================================

DROP POLICY IF EXISTS "manager_read_team_sessions" ON sessions;
CREATE POLICY "manager_read_team_sessions"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = sessions.user_id
        AND u.manager_id = auth.uid()
        AND u.tenant_id = auth_tenant_id()
    )
  );

DROP POLICY IF EXISTS "hr_viewer_read_sessions" ON sessions;
CREATE POLICY "hr_viewer_read_sessions"
  ON sessions FOR SELECT
  USING (
    auth_role() = 'hr_viewer'
    AND sessions.tenant_id = auth_tenant_id()
  );

-- ============================================================
-- RLS: users table - manager team + hr_viewer tenant read
-- ============================================================

DROP POLICY IF EXISTS "manager_read_team_users" ON users;
CREATE POLICY "manager_read_team_users"
  ON users FOR SELECT
  USING (
    users.manager_id = auth.uid()
    AND users.tenant_id = auth_tenant_id()
  );

DROP POLICY IF EXISTS "hr_viewer_read_users" ON users;
CREATE POLICY "hr_viewer_read_users"
  ON users FOR SELECT
  USING (
    auth_role() = 'hr_viewer'
    AND users.tenant_id = auth_tenant_id()
  );
