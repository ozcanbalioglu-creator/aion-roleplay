-- AION Mirror — Staging Part 2 (fixed order)

-- ============================================================
-- FILE: 014_session_activity.sql
-- ============================================================
-- Migration 014: Session last_activity_at tracking

-- Sütun ekle
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Mevcut aktif seanslar için started_at değerini kullan
UPDATE sessions
SET last_activity_at = COALESCE(started_at, created_at)
WHERE last_activity_at IS NULL;

-- Yeni seanslar için default: NOW()
ALTER TABLE sessions
  ALTER COLUMN last_activity_at SET DEFAULT NOW();

-- Index: cron job bu sorguyu sık çalıştırır
CREATE INDEX IF NOT EXISTS idx_sessions_active_activity
  ON sessions(last_activity_at)
  WHERE status = 'active';

-- Session başlatılınca last_activity_at otomatik set eden trigger
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Yeni mesaj eklenince (session_messages INSERT) seansın aktivitesini güncelle
  IF TG_TABLE_NAME = 'session_messages' THEN
    UPDATE sessions
    SET last_activity_at = NOW()
    WHERE id = NEW.session_id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_session_message_activity ON session_messages;
CREATE TRIGGER trg_session_message_activity
  AFTER INSERT ON session_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

COMMENT ON COLUMN sessions.last_activity_at IS
  'Son heartbeat veya mesaj zamanı. Cron job bu değeri kullanarak timeout tespiti yapar.';

-- ============================================================
-- FILE: 20260420000001_014_users_profile_fields.sql
-- ============================================================
-- Add extended profile fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS title      TEXT,
  ADD COLUMN IF NOT EXISTS position   TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS username   TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================
-- FILE: 015_gamification_seed.sql
-- ============================================================
-- Migration 015: Schema genişletme + Gamification seed
-- Sorun: Migration 009 farklı sütun adlarıyla tablo oluşturdu.
-- Bu migration eksik sütunları ALTER TABLE ile ekler, sonra seed verisi yazar.

-- ============================================================
-- 1. badges.category — ENUM yerine TEXT (aynı transaction'da yeni enum
--    değeri kullanılamaz kısıtlamasını ortadan kaldırır)
-- ============================================================
ALTER TABLE badges ALTER COLUMN category TYPE TEXT USING category::TEXT;

-- ============================================================
-- 2. badges tablosu — eksik sütunlar
-- ============================================================
ALTER TABLE badges ADD COLUMN IF NOT EXISTS badge_code TEXT;
UPDATE badges SET badge_code = code WHERE badge_code IS NULL;
ALTER TABLE badges ALTER COLUMN badge_code SET NOT NULL;

ALTER TABLE badges ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🏅';
UPDATE badges SET icon = COALESCE(icon_url, '🏅') WHERE icon = '🏅';

ALTER TABLE badges ADD COLUMN IF NOT EXISTS xp_reward INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'badges_badge_code_key') THEN
    ALTER TABLE badges ADD CONSTRAINT badges_badge_code_key UNIQUE (badge_code);
  END IF;
END $$;

-- ============================================================
-- 3. challenges tablosu — eksik sütunlar
-- ============================================================
-- type ENUM NOT NULL kısıtını kaldır (yeni challenge_type TEXT ile değiştiriyoruz)
ALTER TABLE challenges ALTER COLUMN type DROP NOT NULL;
ALTER TABLE challenges ALTER COLUMN type SET DEFAULT 'weekly_basic';

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS challenge_type TEXT;
UPDATE challenges SET challenge_type = type::TEXT WHERE challenge_type IS NULL;

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS title TEXT;
UPDATE challenges SET title = name WHERE title IS NULL;

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS xp_reward INTEGER NOT NULL DEFAULT 0;
UPDATE challenges SET xp_reward = bonus_points WHERE xp_reward = 0;

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS target_value NUMERIC;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_weekly BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- ============================================================
-- 4. user_challenges tablosu — eksik sütunlar
-- ============================================================
ALTER TABLE user_challenges ADD COLUMN IF NOT EXISTS progress NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE user_challenges ADD COLUMN IF NOT EXISTS target_value NUMERIC;
ALTER TABLE user_challenges ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE user_challenges ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE user_challenges ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- week_start verilerini yeni sütunlara aktar
UPDATE user_challenges
SET
  assigned_at = week_start::TIMESTAMPTZ,
  expires_at  = (week_start + INTERVAL '6 days 23 hours 59 minutes 59 seconds')::TIMESTAMPTZ
WHERE assigned_at IS NULL AND week_start IS NOT NULL;

-- ============================================================
-- 5. gamification_profiles tablosu — eksik sütunlar
-- ============================================================
ALTER TABLE gamification_profiles ADD COLUMN IF NOT EXISTS xp_points INTEGER NOT NULL DEFAULT 0;
UPDATE gamification_profiles SET xp_points = total_points WHERE xp_points = 0;

ALTER TABLE gamification_profiles ADD COLUMN IF NOT EXISTS current_streak SMALLINT NOT NULL DEFAULT 0;
UPDATE gamification_profiles SET current_streak = streak_days WHERE current_streak = 0;

ALTER TABLE gamification_profiles ADD COLUMN IF NOT EXISTS weekly_session_count SMALLINT NOT NULL DEFAULT 0;

-- ============================================================
-- 6. point_transactions tablosu — eksik sütunlar
-- ============================================================
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT;
UPDATE point_transactions SET transaction_type = ref_type WHERE transaction_type IS NULL;

ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS description TEXT;
UPDATE point_transactions SET description = reason WHERE description IS NULL;

ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id);

-- ============================================================
-- 7. notifications tablosu — yeni
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES tenants(id),
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- 8. users tablosu — xp_points ve level
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level SMALLINT NOT NULL DEFAULT 1;

-- ============================================================
-- 9. ROZETLER seed
-- code = badge_code (eski NOT NULL sütunla uyumluluk için)
-- ============================================================
INSERT INTO badges (code, badge_code, name, description, category, criteria, xp_reward, icon, is_active)
VALUES
  ('first_session',  'first_session',  'İlk Adım',       'İlk koçluk seansını tamamla',           'milestone', '{"type":"session_count","value":1}',  50,  '🎯', true),
  ('session_5',      'session_5',      'Beşinci Seans',  '5 seans tamamla',                        'milestone', '{"type":"session_count","value":5}',  100, '⭐', true),
  ('session_20',     'session_20',     'Koç Adayı',      '20 seans tamamla',                       'milestone', '{"type":"session_count","value":20}', 200, '🏅', true),
  ('score_4',        'score_4',        'Kaliteli Koç',   'Herhangi bir seansda 4.0+ puan al',      'score',     '{"type":"min_score","value":4.0}',   75,  '💡', true),
  ('score_4_5',      'score_4_5',      'Usta Koç',       'Herhangi bir seansda 4.5+ puan al',      'score',     '{"type":"min_score","value":4.5}',   150, '🔥', true),
  ('perfect_score',  'perfect_score',  'Mükemmel',       'Herhangi bir seansda 5.0 puan al',       'score',     '{"type":"min_score","value":5.0}',   300, '💎', true),
  ('streak_3',       'streak_3',       'Üç Günlük Seri', '3 gün üst üste seans yap',              'streak',    '{"type":"streak","value":3}',        75,  '🔥', true),
  ('streak_7',       'streak_7',       'Haftalık Seri',  '7 gün üst üste seans yap',              'streak',    '{"type":"streak","value":7}',        200, '⚡', true),
  ('level_2',        'level_2',        'Seviye 2',       'Toplam 300 XP kazan',                    'level',     '{"type":"level","value":2}',         50,  '🥈', true),
  ('level_3',        'level_3',        'Seviye 3',       'Toplam 800 XP kazan',                    'level',     '{"type":"level","value":3}',         100, '🥇', true),
  ('level_4',        'level_4',        'Seviye 4',       'Toplam 1800 XP kazan',                   'level',     '{"type":"level","value":4}',         150, '🏆', true),
  ('level_5',        'level_5',        'Efsane Koç',     'Toplam 3500 XP kazan',                   'level',     '{"type":"level","value":5}',         300, '👑', true)
ON CONFLICT (code) DO UPDATE SET
  badge_code  = EXCLUDED.badge_code,
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  criteria    = EXCLUDED.criteria,
  xp_reward   = EXCLUDED.xp_reward,
  icon        = EXCLUDED.icon,
  is_active   = EXCLUDED.is_active;

-- ============================================================
-- 10. HAFTALIK GÖREVLER seed
-- ============================================================
INSERT INTO challenges (challenge_type, title, name, description, target_value, xp_reward, bonus_points, is_weekly, is_active, tenant_id)
VALUES
  ('complete_sessions', 'Haftalık Seans',  'Haftalık Seans',  'Bu hafta en az 1 koçluk seansı tamamla',             1,   75,  75,  true, true, NULL),
  ('complete_sessions', 'Aktif Hafta',     'Aktif Hafta',     'Bu hafta 2 koçluk seansı tamamla',                   2,   120, 120, true, true, NULL),
  ('achieve_score',     'Kaliteli Koçluk', 'Kaliteli Koçluk', 'Herhangi bir seansda 4.0+ puan hedefle',             4.0, 100, 100, true, true, NULL),
  ('achieve_score',     'Üst Düzey',       'Üst Düzey',       'Ortalama 4.5+ puanla seans bitir',                   4.5, 150, 150, true, true, NULL),
  ('try_persona',       'Yeni Yüz',        'Yeni Yüz',        'Daha önce hiç seans yapmadığın persona ile çalış',  1,   100, 100, true, true, NULL),
  ('streak_maintain',   'Seri Koru',       'Seri Koru',       '3 günlük aktif seans serisine ulaş',                 3,   125, 125, true, true, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FILE: 016_persona_expansion.sql
-- ============================================================
-- Migration 016: Persona Fields Expansion
-- Adds more descriptive fields for AI personas as per latest design requirements

-- 1. Persona Gelişim Tipi Enum'u
DO $$ BEGIN
    CREATE TYPE persona_growth_type AS ENUM (
        'falling_performance', 
        'rising_performance', 
        'resistant_experience', 
        'new_starter', 
        'motivation_crisis'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Personas tablosuna yeni alanlar ekle
ALTER TABLE personas 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS region_area TEXT,
ADD COLUMN IF NOT EXISTS scenario_description TEXT,
ADD COLUMN IF NOT EXISTS growth_type persona_growth_type DEFAULT 'new_starter',
ADD COLUMN IF NOT EXISTS coaching_context TEXT,
ADD COLUMN IF NOT EXISTS coaching_tips TEXT;

-- Mevcut 'name' verilerini first_name'e taşı (opsiyonel ama sağlıklı)
UPDATE personas SET first_name = name WHERE first_name IS NULL;

-- 3. persona_kpis tablosuna realization_rate (gerçekleşme oranı) sütunu ekle 
-- Zaten 'value' vardı ama isimlendirme karışıklığını önlemek için 
-- user 'her KPI için gerçekleşme oranı' dedi. 'value' zaten bunu tutuyor olabilir.
-- 'value' NUMERIC NOT NULL CHECK (value >= 0) olarak tanımlı. 
-- Mevcut yapıyı bozmadan devam edebiliriz.

-- 4. Persona Prompt her zaman linkli olmalı denmiş, zaten persona_prompt_versions tablomuz var.

-- ============================================================
-- FILE: 017_add_persona_location.sql
-- ============================================================
-- Migration 017: Add location field to personas table

ALTER TABLE personas ADD COLUMN IF NOT EXISTS location TEXT;

-- ============================================================
-- FILE: 018_manager_reporting.sql
-- ============================================================
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

-- ============================================================
-- FILE: 019_tenant_website_url.sql
-- ============================================================
-- Migration 019: Tenant website URL

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- ============================================================
-- FILE: 20260421_017_persona_fields_expansion.sql
-- ============================================================
-- Migration 017: Persona fields expansion
-- Adds descriptive columns used by the application that are missing from the base schema

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS first_name          TEXT,
  ADD COLUMN IF NOT EXISTS last_name           TEXT,
  ADD COLUMN IF NOT EXISTS surname             TEXT,
  ADD COLUMN IF NOT EXISTS department          TEXT,
  ADD COLUMN IF NOT EXISTS location            TEXT,
  ADD COLUMN IF NOT EXISTS experience_years    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scenario_description TEXT,
  ADD COLUMN IF NOT EXISTS coaching_context    TEXT,
  ADD COLUMN IF NOT EXISTS coaching_tips       TEXT[] DEFAULT '{}';

-- Backfill first_name from name for existing rows
UPDATE personas SET first_name = name WHERE first_name IS NULL AND name IS NOT NULL;

-- ============================================================
-- FILE: 021_persona_tenant_mapping.sql
-- ============================================================
-- ─── Persona-Tenant Mapping (Super Admin Kararında Hangi Persona Hangi Tenant'ta) ───

CREATE TABLE persona_tenant_mapping (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Aynı persona-tenant kombinasyonu bir kere
  UNIQUE(persona_id, tenant_id)
);

CREATE INDEX idx_persona_tenant_mapping_persona ON persona_tenant_mapping(persona_id);
CREATE INDEX idx_persona_tenant_mapping_tenant ON persona_tenant_mapping(tenant_id);
CREATE INDEX idx_persona_tenant_mapping_active ON persona_tenant_mapping(is_active);

-- ─── Update Trigger for persona_tenant_mapping ──────────────────────────────
CREATE TRIGGER persona_tenant_mapping_updated_at
  BEFORE UPDATE ON persona_tenant_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS: Persona-Tenant Mapping Politikaları ──────────────────────────────

-- Super Admin hepsini görebilir
CREATE POLICY "super_admin_view_all_mappings"
ON persona_tenant_mapping FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'super_admin'
);

-- Super Admin insert/update/delete yapabilir
CREATE POLICY "super_admin_manage_mappings"
ON persona_tenant_mapping FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'role' = 'super_admin'
);

CREATE POLICY "super_admin_update_mappings"
ON persona_tenant_mapping FOR UPDATE
USING (auth.jwt() ->> 'role' = 'super_admin')
WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY "super_admin_delete_mappings"
ON persona_tenant_mapping FOR DELETE
USING (auth.jwt() ->> 'role' = 'super_admin');

-- Tenant Admin, kendi tenant'ında eşlenmiş personaları görebilir (read-only)
CREATE POLICY "tenant_admin_view_own_mappings"
ON persona_tenant_mapping FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'tenant_admin'
  AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- ─── View: Tenant İçin Erişilebilir Personalar ──────────────────────────────
CREATE OR REPLACE VIEW tenant_available_personas AS
SELECT DISTINCT
  p.id,
  p.name,
  p.surname,
  p.title,
  p.difficulty,
  p.personality_type,
  p.emotional_baseline,
  p.is_active,
  p.avatar_image_url,
  ptm.tenant_id,
  ptm.assigned_at
FROM personas p
INNER JOIN persona_tenant_mapping ptm ON p.id = ptm.persona_id
WHERE ptm.is_active = true AND p.is_active = true
ORDER BY ptm.assigned_at DESC;

ALTER TABLE persona_tenant_mapping ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FILE: 022_fix_persona_tenant_rls.sql
-- ============================================================
-- Fix: persona_tenant_mapping RLS policies were using auth.jwt() ->> 'role'
-- but role is stored under user_metadata, not the JWT root.
-- Replace with is_super_admin() and auth_tenant_id() helpers (same as all other tables).

DROP POLICY IF EXISTS "super_admin_view_all_mappings"   ON persona_tenant_mapping;
DROP POLICY IF EXISTS "super_admin_manage_mappings"     ON persona_tenant_mapping;
DROP POLICY IF EXISTS "super_admin_update_mappings"     ON persona_tenant_mapping;
DROP POLICY IF EXISTS "super_admin_delete_mappings"     ON persona_tenant_mapping;
DROP POLICY IF EXISTS "tenant_admin_view_own_mappings"  ON persona_tenant_mapping;
DROP POLICY IF EXISTS "super_admin_all_mappings"        ON persona_tenant_mapping;

CREATE POLICY "super_admin_all_mappings"
  ON persona_tenant_mapping FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "tenant_admin_view_own_mappings"
  ON persona_tenant_mapping FOR SELECT
  USING (
    auth_role() = 'tenant_admin'
    AND tenant_id = auth_tenant_id()
  );

-- ============================================================
-- FILE: 022_update_rls_manager_access.sql
-- ============================================================
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

-- ============================================================
-- FILE: 20260421_018_scenarios_align.sql
-- ============================================================
-- Migration 018: Scenarios table alignment
-- Kod tarafı difficulty_level, target_skills, context_setup, estimated_duration_min
-- kullanırken tablo bunları eksik tutuyordu. Bu migration düzeltiyor.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS difficulty_level     SMALLINT DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS target_skills        TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS context_setup        TEXT,
  ADD COLUMN IF NOT EXISTS estimated_duration_min SMALLINT DEFAULT 15;

-- Eğer eski 'difficulty' kolonu varsa değerlerini taşı
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenarios' AND column_name = 'difficulty'
  ) THEN
    UPDATE scenarios
    SET difficulty_level = difficulty::SMALLINT
    WHERE difficulty_level IS NULL OR difficulty_level = 3;
  END IF;
END $$;

-- target_skill_codes varsa target_skills'e kopyala
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenarios' AND column_name = 'target_skill_codes'
  ) THEN
    UPDATE scenarios
    SET target_skills = target_skill_codes
    WHERE target_skills = '{}' OR target_skills IS NULL;
  END IF;
END $$;

-- ============================================================
-- FILE: 20260421_019_scenario_seed.sql
-- ============================================================
-- Seed verisi kaldırıldı — rubric template, boyutlar, persona ve senaryolar
-- uygulama UI'ından (super_admin) oluşturulmalıdır.
-- Hardcoded UUID ile persona/senaryo referansı staging ortamında FK hatası
-- ürettiğinden bu blok kasıtlı olarak boş bırakıldı.

-- ============================================================
-- FILE: 20260421_020_scenario_mood_hint.sql
-- ============================================================
-- Migration 020: Persona duygusal durum ipucu kolonu (şema değişikliği)
-- context_setup AI için talimat içerir; mood_hint kullanıcıya gösterilir.
-- NOT: Seed verisi (9 senaryo için mood_hint güncelleme) kaldırıldı —
--      senaryolar UI'dan oluşturulduğunda mood_hint alanı form üzerinden doldurulur.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS mood_hint TEXT;

-- ============================================================
-- FILE: 20260422_021_gamification_schema_fix.sql
-- ============================================================
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

-- ============================================================
-- FILE: 20260422_022_sessions_session_mode.sql
-- ============================================================
-- Add session_mode column to sessions table if it doesn't exist
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_mode TEXT NOT NULL DEFAULT 'text'
    CHECK (session_mode IN ('text', 'voice'));

-- ============================================================
-- FILE: 20260422_023_storage_avatars_bucket.sql
-- ============================================================
-- Create public avatars bucket for user profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
CREATE POLICY "avatars_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own avatar
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access to all avatars
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- ============================================================
-- FILE: 20260424_024_badges_schema_unification.sql
-- ============================================================
-- P0-002: badges şema birleşimi — badge_code dualizmi giderildi
-- Idempotent: Supabase SQL Editor'a güvenle yapıştırılabilir.

-- 1. badge_code değeri varsa ama code yoksa, badge_code'u code'a kopyala
UPDATE badges SET code = badge_code WHERE code IS NULL AND badge_code IS NOT NULL;

-- 2. badge_code unique index'ini düşür
DROP INDEX IF EXISTS idx_badges_badge_code;

-- 3. badge_code kolonunu kaldır
ALTER TABLE badges DROP COLUMN IF EXISTS badge_code;

-- 4. code kolonunu NOT NULL yap (önce NULL olanları fallback değerle doldur)
UPDATE badges SET code = 'legacy_' || id::text WHERE code IS NULL;
ALTER TABLE badges ALTER COLUMN code SET NOT NULL;

-- 5. Tenant-özgü rozetler için unique index: (tenant_id, code) kombinasyonu
DROP INDEX IF EXISTS idx_badges_code_tenant;
CREATE UNIQUE INDEX idx_badges_code_tenant ON badges (tenant_id, code) WHERE tenant_id IS NOT NULL;

-- 6. Global rozetler için unique index: sadece code
DROP INDEX IF EXISTS idx_badges_code_global;
CREATE UNIQUE INDEX idx_badges_code_global ON badges (code) WHERE tenant_id IS NULL;

-- 7. badges UPDATE policy
DROP POLICY IF EXISTS "badges_tenant_update" ON badges;
CREATE POLICY "badges_tenant_update" ON badges
  FOR UPDATE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- 8. badges DELETE policy
DROP POLICY IF EXISTS "badges_tenant_delete" ON badges;
CREATE POLICY "badges_tenant_delete" ON badges
  FOR DELETE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- 9. challenges UPDATE policy
DROP POLICY IF EXISTS "challenges_tenant_update" ON challenges;
CREATE POLICY "challenges_tenant_update" ON challenges
  FOR UPDATE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- 10. challenges DELETE policy
DROP POLICY IF EXISTS "challenges_tenant_delete" ON challenges;
CREATE POLICY "challenges_tenant_delete" ON challenges
  FOR DELETE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'super_admin')
  );

-- 11. Super admin global rozetleri yönetebilir
DROP POLICY IF EXISTS "badges_superadmin_update" ON badges;
CREATE POLICY "badges_superadmin_update" ON badges
  FOR UPDATE USING (tenant_id IS NULL AND auth_role() = 'super_admin');

DROP POLICY IF EXISTS "badges_superadmin_delete" ON badges;
CREATE POLICY "badges_superadmin_delete" ON badges
  FOR DELETE USING (tenant_id IS NULL AND auth_role() = 'super_admin');

DROP POLICY IF EXISTS "challenges_superadmin_update" ON challenges;
CREATE POLICY "challenges_superadmin_update" ON challenges
  FOR UPDATE USING (tenant_id IS NULL AND auth_role() = 'super_admin');

DROP POLICY IF EXISTS "challenges_superadmin_delete" ON challenges;
CREATE POLICY "challenges_superadmin_delete" ON challenges
  FOR DELETE USING (tenant_id IS NULL AND auth_role() = 'super_admin');

-- ============================================================
-- FILE: 20260424_025_users_self_update_rls.sql
-- ============================================================
-- ─── P0-004: users self-update RLS policy yenileme ──────────────────────────
--
-- Sorun:
--   002_rls_policies.sql'deki "user_update_own_profile" policy WITH CHECK'inde
--   recursive subquery var:
--     AND role = (SELECT role FROM users WHERE id = auth.uid())
--     AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
--   is_active korunmuyor. Ayrıca profil update action'ı createServiceClient()
--   ile çağrılıyordu; key eksik/yanlış olunca RLS'e geri düşüyor ve subquery
--   auth.uid() = NULL ile FALSE dönüyor, update bloklanıyordu.
--
-- Düzeltme:
--   1. Eski policy DROP edilir.
--   2. Yeni policy: sadece USING/WITH CHECK = auth.uid() = id.
--      role, tenant_id ve is_active bu action'da hiç SET edilmediği için
--      korunur. Bunları değiştirmeye çalışan ayrı bir policy yoktur.
--   3. avatar_url güncellemesi de aynı policy kapsamında çalışır.
--
-- Operasyonel Not — Avatar Storage:
--   20260422_023_storage_avatars_bucket.sql migration'ının Supabase projesine
--   uygulandığını doğrulayın (SQL Editor). Bucket yoksa uploadAvatarAction
--   "Bucket not found" hatası üretir. Bu kod değişikliği değil, deploy adımıdır.

DROP POLICY IF EXISTS "user_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_self_update" ON public.users;

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
  );

-- ============================================================
-- FILE: 20260424_026_rubric_dimensions_fields.sql
-- ============================================================
-- Migration 026: rubric_dimensions tablosuna eksik kolonlar
-- RubricDimensionCard bileşeni ve updateRubricDimensionAction bu kolonları kullanıyor.

ALTER TABLE rubric_dimensions
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS weight      NUMERIC      NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN      NOT NULL DEFAULT true;

