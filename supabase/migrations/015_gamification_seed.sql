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
