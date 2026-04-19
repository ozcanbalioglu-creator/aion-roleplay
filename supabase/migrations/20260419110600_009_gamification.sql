-- ─── Gamification Profiles ───────────────────────────────────────────────────
-- Her kullanıcı için bir satır
CREATE TABLE gamification_profiles (
  user_id              UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id            UUID        NOT NULL REFERENCES tenants(id),
  total_points         INTEGER     NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  level                SMALLINT    NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  completed_sessions   INTEGER     NOT NULL DEFAULT 0,
  streak_days          SMALLINT    NOT NULL DEFAULT 0,
  last_session_date    DATE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gamification_tenant_id ON gamification_profiles(tenant_id);

-- ─── Badges ──────────────────────────────────────────────────────────────────
CREATE TYPE badge_category AS ENUM ('milestone', 'skill', 'difficulty', 'streak', 'improvement');

CREATE TABLE badges (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT           NOT NULL UNIQUE,
  name         TEXT           NOT NULL,
  description  TEXT           NOT NULL,
  icon_url     TEXT,
  category     badge_category NOT NULL,
  -- Kazanım kriteri (JSON, badge tipine göre değişir)
  -- Örn: {"completed_sessions": 5} veya {"dimension_code": "active_listening", "min_score": 4.5}
  criteria     JSONB          NOT NULL DEFAULT '{}',
  is_active    BOOLEAN        NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ─── User Badges ─────────────────────────────────────────────────────────────
CREATE TABLE user_badges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES tenants(id),
  badge_id    UUID        NOT NULL REFERENCES badges(id),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id  UUID        REFERENCES sessions(id)
);

CREATE UNIQUE INDEX idx_user_badges_unique ON user_badges(user_id, badge_id);
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);

-- ─── Challenges (Haftalık Görev Şablonları) ───────────────────────────────────
CREATE TYPE challenge_type AS ENUM (
  'weekly_basic',      -- Haftada 1 seans
  'discovery',         -- Hiç denemedik persona
  'improvement',       -- Düşük puanlı personaya geri dön
  'difficulty'         -- Zorluk 4+ persona
);

CREATE TABLE challenges (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  type         challenge_type NOT NULL,
  name         TEXT           NOT NULL,
  description  TEXT           NOT NULL,
  bonus_points INTEGER        NOT NULL DEFAULT 0,
  -- Tamamlanma kriterleri (JSON)
  criteria     JSONB          NOT NULL DEFAULT '{}',
  is_active    BOOLEAN        NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ─── User Challenges ──────────────────────────────────────────────────────────
CREATE TABLE user_challenges (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id      UUID        NOT NULL REFERENCES tenants(id),
  challenge_id   UUID        NOT NULL REFERENCES challenges(id),
  -- Hangi haftanın görevi (pazartesi tarihi)
  week_start     DATE        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'expired')),
  -- Tamamlandıysa hangi seans ile
  completed_session_id UUID  REFERENCES sessions(id),
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX idx_user_challenges_week ON user_challenges(user_id, week_start);
-- Note: Unique constraint for weekly_basic challenges enforced at application level

-- ─── Point Transaction Log ────────────────────────────────────────────────────
-- Her puan kazanım olayı buraya kayıt edilir
CREATE TABLE point_transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES tenants(id),
  points        INTEGER     NOT NULL,
  reason        TEXT        NOT NULL,
  -- İlgili kayıt (session, badge, challenge)
  ref_type      TEXT        CHECK (ref_type IN ('session', 'badge', 'challenge', 'bonus')),
  ref_id        UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_transactions_user_id ON point_transactions(user_id);

-- ─── Badge Seed (V1 Başlangıç Seti) ──────────────────────────────────────────
INSERT INTO badges (code, name, description, category, criteria) VALUES
  ('first_session',      'İlk Adım',        'İlk koçluk seansını tamamladın',            'milestone', '{"completed_sessions": 1}'),
  ('fifth_session',      '5. Seans',         '5 koçluk seansı tamamladın',                'milestone', '{"completed_sessions": 5}'),
  ('tenth_session',      '10. Seans',        '10 koçluk seansı tamamladın',               'milestone', '{"completed_sessions": 10}'),
  ('high_empathy',       'Empatik Lider',    'Empati boyutunda ortalama 4.5+ aldın',      'skill',     '{"dimension_code": "empathy", "min_avg": 4.5}'),
  ('strong_listener',    'Güçlü Dinleyici',  'Aktif dinleme boyutunda ortalama 4.5+ aldın','skill',    '{"dimension_code": "active_listening", "min_avg": 4.5}'),
  ('hard_challenger',    'Zorluk Avcısı',    'Zorluk 4+ persona ile seans tamamladın',   'difficulty','{"min_difficulty": 4}'),
  ('four_week_streak',   '4 Haftalık Seri',  '4 hafta üst üste haftalık hedefi tutturdun','streak',   '{"consecutive_weeks": 4}'),
  ('comeback_champion',  'Geri Dönüş Ustası','Düşük puanlı personada 1 puan artırdın',   'improvement','{"score_improvement": 1.0}')
ON CONFLICT (code) DO NOTHING;

-- ─── Challenge Seed ──────────────────────────────────────────────────────────
INSERT INTO challenges (type, name, description, bonus_points, criteria) VALUES
  ('weekly_basic',  'Haftalık Seans',     'Bu hafta en az 1 seans tamamla',                  30, '{"min_sessions": 1}'),
  ('discovery',     'Yeni Keşif',         'Daha önce hiç seans yapmadığın bir persona dene', 40, '{"never_tried": true}'),
  ('improvement',   'Geri Dönüş Zamanı', 'Daha önce düşük puan aldığın personaya geri dön', 60, '{"min_previous_score": 0, "max_previous_score": 3.0}'),
  ('difficulty',    'Zorluk Meydan Oku', 'Zorluk seviyesi 4 veya 5 bir persona ile seans yap',80, '{"min_difficulty": 4}')
ON CONFLICT DO NOTHING;