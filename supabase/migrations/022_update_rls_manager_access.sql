-- ─── RLS: Manager'lar Ekibinin Seanslarını Görebilir ──────────────────────────

-- Helper function: Bir kullanıcının (manager_id olarak) kimin ekibinde olduğunu bulur
CREATE OR REPLACE FUNCTION get_manager_subordinates(p_manager_id UUID)
RETURNS TABLE(user_id UUID) AS $$
WITH RECURSIVE team AS (
  -- Doğrudan raporlayanlar
  SELECT id AS user_id FROM public.users WHERE manager_id = p_manager_id

  UNION ALL

  -- Dolaylı raporlayanlar (recursive)
  SELECT u.id
  FROM public.users u
  INNER JOIN team t ON u.manager_id = t.user_id
)
SELECT user_id FROM team;
$$ LANGUAGE SQL STABLE;

-- ─── Sessions Table'ında Manager Read Policy ─────────────────────────────────
-- Manager'lar kendi ekiplerinin seanslarını görebilir
CREATE POLICY "manager_view_team_sessions"
ON sessions FOR SELECT
USING (
  (auth.jwt() ->> 'role' = 'manager'
   AND user_id IN (SELECT get_manager_subordinates((auth.jwt() ->> 'user_id')::uuid)))
  OR (auth.jwt() ->> 'role' = 'manager' AND user_id = auth.uid())
);

-- ─── Evaluations Table'ında Manager Read Policy ───────────────────────────────
-- Manager'lar kendi ekiplerinin değerlendirmelerini görebilir
CREATE POLICY "manager_view_team_evaluations"
ON evaluations FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'manager'
  AND session_id IN (
    SELECT id FROM sessions
    WHERE user_id IN (SELECT get_manager_subordinates((auth.jwt() ->> 'user_id')::uuid))
       OR user_id = auth.uid()
  )
);

-- ─── Users Table'ında Güncellemeler ──────────────────────────────────────────
-- Tenant Admin kendi tenant'ında kullanıcı görebilir (ama manager_id atanması var)
CREATE POLICY "tenant_admin_view_own_users"
ON users FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'tenant_admin'
  AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- Manager kendi ekibini + kendisini görebilir
CREATE POLICY "manager_view_team"
ON users FOR SELECT
USING (
  (auth.jwt() ->> 'role' = 'manager'
   AND (id = auth.uid() OR id IN (SELECT get_manager_subordinates(auth.uid()))))
);

-- Tenant Admin can update users (including setting manager_id)
CREATE POLICY "tenant_admin_update_users"
ON users FOR UPDATE
USING (
  auth.jwt() ->> 'role' = 'tenant_admin'
  AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'tenant_admin'
  AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  -- manager_id constraint önceden tanımlı (same tenant check)
);

-- ─── View: Manager'ın Göreceği Ekip ────────────────────────────────────────
CREATE OR REPLACE VIEW manager_team_view AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.created_at,
  m.full_name AS manager_name
FROM users u
LEFT JOIN users m ON u.manager_id = m.id
WHERE u.manager_id = (auth.jwt() ->> 'user_id')::uuid
   OR u.id = (auth.jwt() ->> 'user_id')::uuid;
