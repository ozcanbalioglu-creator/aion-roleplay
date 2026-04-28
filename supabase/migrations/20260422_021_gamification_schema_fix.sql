-- badges tablosuna eksik kolonlar
ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS tenant_id   UUID REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS badge_code  TEXT,
  ADD COLUMN IF NOT EXISTS xp_reward   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icon        TEXT;

-- badge_code unique index (varsa atla)
CREATE UNIQUE INDEX IF NOT EXISTS idx_badges_badge_code ON badges(badge_code) WHERE badge_code IS NOT NULL;

-- badges RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges_select_tenant" ON badges;
CREATE POLICY "badges_select_tenant" ON badges
  FOR SELECT USING (
    tenant_id IS NULL OR tenant_id = auth_tenant_id()
  );

DROP POLICY IF EXISTS "badges_tenant_insert" ON badges;
CREATE POLICY "badges_tenant_insert" ON badges
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- challenges tablosuna eksik kolonlar
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS tenant_id      UUID REFERENCES tenants(id),
  ADD COLUMN IF NOT EXISTS challenge_type TEXT,
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS target_value   NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_reward      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_weekly      BOOLEAN NOT NULL DEFAULT true;

-- challenges RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_select_tenant" ON challenges;
CREATE POLICY "challenges_select_tenant" ON challenges
  FOR SELECT USING (
    tenant_id IS NULL OR tenant_id = auth_tenant_id()
  );

DROP POLICY IF EXISTS "challenges_tenant_insert" ON challenges;
CREATE POLICY "challenges_tenant_insert" ON challenges
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );
