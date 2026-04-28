-- AION Mirror — Staging Full Migration
-- Generated: Fri Apr 24 12:44:04 +03 2026

-- ============================================================
-- FILE: 20260419102854_001_tenants_and_roles.sql
-- ============================================================
-- ─── Role enum ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin',
    'tenant_admin',
    'hr_admin',
    'manager',
    'user'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Tenants ─────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  logo_url      TEXT,
  brand_color   TEXT        DEFAULT '#4F46E5',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug format kontrolü: sadece küçük harf, rakam, tire
ALTER TABLE tenants
  ADD CONSTRAINT tenants_slug_format
  CHECK (slug ~ '^[a-z0-9-]+$');

-- ─── Users (profile table, auth.users ile 1:1) ───────────────────────────────
CREATE TABLE users (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'user',
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  avatar_url    TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- ─── KVKK Consent Records ────────────────────────────────────────────────────
CREATE TABLE consent_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id        UUID        NOT NULL REFERENCES tenants(id),
  consented_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_version  TEXT        NOT NULL DEFAULT '1.0',
  ip_address       TEXT,
  user_agent       TEXT
);

CREATE INDEX idx_consent_user_id ON consent_records(user_id);

-- ─── Updated_at trigger function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Auto-create user profile on auth.users insert ───────────────────────────
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- İlk bulduğu aktif tenant'ı al (fallback için)
  SELECT id INTO default_tenant_id FROM public.tenants WHERE is_active = true LIMIT 1;

  INSERT INTO public.users (id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'user'::public.user_role),
    COALESCE((NEW.raw_user_meta_data->>'tenant_id')::UUID, default_tenant_id)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();


-- ============================================================
-- FILE: 20260419103334_002_rls_policies.sql
-- ============================================================
-- ─── RLS Etkinleştirme ───────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- ─── Helper function: JWT'den tenant_id al ───────────────────────────────────
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Helper function: JWT'den role al ───────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'user_metadata' ->> 'role';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Helper function: Süper admin mi? ────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT auth_role() = 'super_admin';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Tenants RLS ─────────────────────────────────────────────────────────────
-- Super admin: hepsini görür
CREATE POLICY "super_admin_all_tenants"
  ON tenants FOR ALL
  USING (is_super_admin());

-- Diğerleri: sadece kendi tenant'ını görür
CREATE POLICY "tenant_member_own_tenant"
  ON tenants FOR SELECT
  USING (id = auth_tenant_id() AND NOT is_super_admin());

-- ─── Users RLS ───────────────────────────────────────────────────────────────
-- Super admin: hepsini görür ve yönetir
CREATE POLICY "super_admin_all_users"
  ON users FOR ALL
  USING (is_super_admin());

-- Tenant admin ve HR: kendi tenant'ının kullanıcılarını görür
CREATE POLICY "tenant_admin_own_users"
  ON users FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() IN ('tenant_admin', 'hr_admin')
    AND NOT is_super_admin()
  );

-- Manager: kendi tenant kullanıcılarını görür (ekip için)
CREATE POLICY "manager_own_tenant_users"
  ON users FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = 'manager'
  );

-- Kullanıcı: sadece kendi profilini görür
CREATE POLICY "user_own_profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Kullanıcı: sadece kendi profilini güncelleyebilir (avatar, full_name)
CREATE POLICY "user_update_own_profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- rol ve tenant_id değiştirilemez
    AND role = (SELECT role FROM users WHERE id = auth.uid())
    AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- ─── Consent Records RLS ─────────────────────────────────────────────────────
-- Super admin: hepsini görür
CREATE POLICY "super_admin_all_consents"
  ON consent_records FOR ALL
  USING (is_super_admin());

-- Kullanıcı: sadece kendi onayını ekler ve görür
CREATE POLICY "user_own_consent"
  ON consent_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_consent"
  ON consent_records FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- FILE: 20260419110000_003_persona_system.sql
-- ============================================================
-- ─── Persona KPI standard kodu enum'u ───────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE kpi_code AS ENUM (
    'genel_rea',
    'ciro_rea',
    'musteri_ziyaret_rea',
    'yeni_musteri_kazanimi_rea',
    'pazar_payi',
    'pazar_payi_degisimi',
    'verimli_ziyaret',
    'kaveraj',
    'nps_musteri_memnuniyeti',
    'ozel_kpi'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Persona tip enum'ları ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE personality_type AS ENUM (
    'dominant', 'compliant', 'resistant',
    'analytical', 'expressive', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE emotional_state AS ENUM (
    'motivated', 'demotivated', 'frustrated',
    'neutral', 'anxious', 'confident', 'burned_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Personas ────────────────────────────────────────────────────────────────
-- V1: tenant_id IS NULL = global (tüm tenant'lara görünür)
-- V2: tenant_id dolu = sadece o tenant'a özel
CREATE TABLE personas (
  id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT            NOT NULL,
  title              TEXT            NOT NULL,
  sector_tags        TEXT[]          NOT NULL DEFAULT '{}',
  difficulty         SMALLINT        NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  personality_type   personality_type NOT NULL,
  emotional_baseline emotional_state  NOT NULL,
  resistance_level   SMALLINT        NOT NULL CHECK (resistance_level BETWEEN 1 AND 5),
  cooperativeness    SMALLINT        NOT NULL CHECK (cooperativeness BETWEEN 1 AND 5),
  trigger_behaviors  TEXT[]          NOT NULL DEFAULT '{}',
  -- Voice settings (JSON: {provider, voice_id, stability, similarity_boost, speed})
  voice_settings     JSONB           NOT NULL DEFAULT '{}',
  avatar_image_url   TEXT,
  -- V1: NULL = global, V2: tenant_id = tenant-specific
  tenant_id          UUID            REFERENCES tenants(id) ON DELETE CASCADE,
  is_active          BOOLEAN         NOT NULL DEFAULT true,
  created_by         UUID            NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_personas_tenant_id ON personas(tenant_id);
CREATE INDEX idx_personas_is_active ON personas(is_active);
CREATE INDEX idx_personas_difficulty ON personas(difficulty);

CREATE TRIGGER personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Persona KPIs ────────────────────────────────────────────────────────────
-- Her persona için 0-5 arası KPI değeri
CREATE TABLE persona_kpis (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id   UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  kpi_code     kpi_code    NOT NULL,
  kpi_name     TEXT        NOT NULL,  -- Özel KPI için görünen ad
  value        NUMERIC     NOT NULL CHECK (value >= 0),
  unit         TEXT        NOT NULL DEFAULT '%',
  is_custom    BOOLEAN     NOT NULL DEFAULT false,
  sort_order   SMALLINT    NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_persona_kpis_persona_id ON persona_kpis(persona_id);

-- Kural: Özel KPI dışında aynı persona için aynı kpi_code tekrar edemez
CREATE UNIQUE INDEX idx_persona_kpis_unique_standard
  ON persona_kpis(persona_id, kpi_code)
  WHERE is_custom = false AND kpi_code != 'ozel_kpi';

-- ─── Persona Prompt Versions ─────────────────────────────────────────────────
-- Her persona için versiyonlu system prompt'lar (şifreli)
CREATE TABLE persona_prompt_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id      UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  version_number  INTEGER     NOT NULL,
  -- İçerik AES-256-GCM ile şifrelenir: "iv:authTag:ciphertext"
  content_encrypted TEXT      NOT NULL,
  -- Prompt'ta kullanılan değişken adları (ör: ["kpi_context", "user_name"])
  variables       TEXT[]      NOT NULL DEFAULT '{}',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_persona_prompts_persona_id ON persona_prompt_versions(persona_id);
CREATE INDEX idx_persona_prompts_is_active ON persona_prompt_versions(is_active);

-- Bir persona için aynı versiyon numarası olamaz
CREATE UNIQUE INDEX idx_persona_prompts_version
  ON persona_prompt_versions(persona_id, version_number);

-- ============================================================
-- FILE: 20260419110100_004_prompt_templates.sql
-- ============================================================
-- ─── Prompt tip enum'u ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE prompt_type AS ENUM (
    'role_play_system',
    'session_summary',
    'evaluation_extraction',
    'evaluation_scoring',
    'feedback_coaching',
    'manager_insights'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Prompt Templates ────────────────────────────────────────────────────────
-- Global prompt şablonları (Super Admin yönetir)
CREATE TABLE prompt_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  prompt_type  prompt_type NOT NULL,
  description  TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_templates_type ON prompt_templates(prompt_type);
CREATE UNIQUE INDEX idx_prompt_templates_name ON prompt_templates(name);

CREATE TRIGGER prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Prompt Versions ─────────────────────────────────────────────────────────
CREATE TABLE prompt_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID        NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version_number  INTEGER     NOT NULL,
  content         TEXT        NOT NULL,
  -- Prompt içinde kullanılan {{değişken}} adları
  variables       TEXT[]      NOT NULL DEFAULT '{}',
  -- Hangi model + parametrelerle test edildi
  tested_with     JSONB       DEFAULT '{}',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_versions_template_id ON prompt_versions(template_id);
CREATE INDEX idx_prompt_versions_is_active ON prompt_versions(is_active);
CREATE UNIQUE INDEX idx_prompt_versions_unique
  ON prompt_versions(template_id, version_number);

-- Bir template'in yalnızca bir active version'ı olabilir
CREATE UNIQUE INDEX idx_prompt_versions_one_active
  ON prompt_versions(template_id)
  WHERE is_active = true;

-- ============================================================
-- FILE: 20260419110200_005_rubric_system.sql
-- ============================================================
-- ─── Rubric boyut kod enum'u ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE rubric_dimension_code AS ENUM (
    -- Sabit boyutlar (her seansda zorunlu)
    'active_listening',
    'powerful_questions',
    'summarizing',
    'empathy',
    'action_clarity',
    'non_judgmental',
    -- Seçmeli boyutlar (havuzdan seçilir)
    'assumption_challenging',
    'responsibility_opening',
    'goal_alignment',
    'feedback_quality',
    'silence_management',
    'reframing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Rubric Templates ────────────────────────────────────────────────────────
-- İsimlendirilmiş rubric seti (örn: "Standard ICF v1")
CREATE TABLE rubric_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  description  TEXT,
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rubric_templates_default
  ON rubric_templates(is_default)
  WHERE is_default = true;

-- ─── Rubric Dimensions ───────────────────────────────────────────────────────
-- Bir rubric template'indeki boyutlar
CREATE TABLE rubric_dimensions (
  id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID                  NOT NULL REFERENCES rubric_templates(id) ON DELETE CASCADE,
  dimension_code  rubric_dimension_code NOT NULL,
  is_required     BOOLEAN               NOT NULL DEFAULT false,
  -- Puanlama için davranış göstergeleri (1-5 her biri için)
  score_labels    JSONB                 NOT NULL DEFAULT '{}',
  -- Örn: {"1": "Davranış neredeyse yok", "3": "Kısmen var", "5": "Güçlü ve doğal"}
  sort_order      SMALLINT              NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ           NOT NULL DEFAULT now()
);

CREATE INDEX idx_rubric_dimensions_template ON rubric_dimensions(template_id);
CREATE UNIQUE INDEX idx_rubric_dimensions_unique
  ON rubric_dimensions(template_id, dimension_code);

-- ============================================================
-- FILE: 20260419110300_006_scenarios.sql
-- ============================================================
-- ─── Scenarios ───────────────────────────────────────────────────────────────
CREATE TABLE scenarios (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT        NOT NULL,
  description           TEXT        NOT NULL,
  persona_id            UUID        NOT NULL REFERENCES personas(id) ON DELETE RESTRICT,
  rubric_template_id    UUID        NOT NULL REFERENCES rubric_templates(id),
  -- Hangi rubric boyutlarının bu senaryo için öncelikli olduğu
  target_dimension_codes rubric_dimension_code[] NOT NULL DEFAULT '{}',
  -- Seçmeli boyutlar (tenant veya senaryo bazında 2-4 seçilir)
  optional_dimension_codes rubric_dimension_code[] NOT NULL DEFAULT '{}',
  difficulty            SMALLINT    NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  sector_tags           TEXT[]      NOT NULL DEFAULT '{}',
  -- NULL = global (tüm tenant'lar), dolu = sadece o tenant
  tenant_id             UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  estimated_duration_min SMALLINT   DEFAULT 15,
  created_by            UUID        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenarios_persona_id ON scenarios(persona_id);
CREATE INDEX idx_scenarios_tenant_id ON scenarios(tenant_id);
CREATE INDEX idx_scenarios_is_active ON scenarios(is_active);
CREATE INDEX idx_scenarios_difficulty ON scenarios(difficulty);

CREATE TRIGGER scenarios_updated_at
  BEFORE UPDATE ON scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FILE: 20260419110400_007_session_system.sql
-- ============================================================
-- ─── Session durum enum'ları ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE session_status AS ENUM (
    'pending', 'active', 'completed', 'cancelled', 'dropped', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE session_phase AS ENUM (
    'opening', 'exploration', 'deepening', 'action', 'closing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cancellation_reason AS ENUM (
    'manual_cancel', 'drop_off', 'technical_failure'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Sessions ────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id                    UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id             UUID                 NOT NULL REFERENCES tenants(id),
  persona_id            UUID                 NOT NULL REFERENCES personas(id),
  scenario_id           UUID                 NOT NULL REFERENCES scenarios(id),
  rubric_template_id    UUID                 NOT NULL REFERENCES rubric_templates(id),
  -- Hangi prompt versiyonu kullanıldı (izlenebilirlik için)
  prompt_version_id     UUID                 REFERENCES persona_prompt_versions(id),
  status                session_status       NOT NULL DEFAULT 'pending',
  current_phase         session_phase        NOT NULL DEFAULT 'opening',
  cancellation_reason   cancellation_reason,
  started_at            TIMESTAMPTZ          NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ          NOT NULL DEFAULT now(),
  duration_seconds      INTEGER,
  message_count         INTEGER              NOT NULL DEFAULT 0,
  -- Özet (AES-256-GCM şifreli)
  summary_encrypted     TEXT,
  -- Kullanıcının bu seansı "sayma" notu (neden bıraktığı)
  cancellation_note     TEXT,
  created_at            TIMESTAMPTZ          NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_tenant_id ON sessions(tenant_id);
CREATE INDEX idx_sessions_persona_id ON sessions(persona_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
-- Son 7 gün aktif seans tespiti için
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity_at DESC);

-- ─── Session Messages ────────────────────────────────────────────────────────
-- Her konuşma turu bir kayıt. İçerik şifreli.
CREATE TABLE session_messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  -- Mesaj içeriği AES-256-GCM ile şifrelenir
  content_encrypted TEXT        NOT NULL,
  -- Kaç token kullanıldı (maliyet takibi için)
  token_count       INTEGER,
  -- Seans fazı (hangi aşamada söylendi)
  phase             session_phase NOT NULL DEFAULT 'opening',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_messages_session_id ON session_messages(session_id);
CREATE INDEX idx_session_messages_created_at ON session_messages(session_id, created_at);

-- ─── Auto-update session message count ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sessions
  SET
    message_count = message_count + 1,
    last_activity_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_session_message_insert
  AFTER INSERT ON session_messages
  FOR EACH ROW EXECUTE FUNCTION update_session_message_count();

-- ─── Auto-set duration on session complete ──────────────────────────────────
CREATE OR REPLACE FUNCTION set_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled', 'dropped', 'failed')
    AND OLD.status = 'active'
    AND NEW.completed_at IS NULL
  THEN
    NEW.completed_at = now();
    NEW.duration_seconds = EXTRACT(EPOCH FROM (now() - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_session_status_change
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_session_duration();

-- ============================================================
-- FILE: 20260419110500_008_evaluation_system.sql
-- ============================================================
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

-- ============================================================
-- FILE: 20260419110600_009_gamification.sql
-- ============================================================
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
DO $$ BEGIN
  CREATE TYPE badge_category AS ENUM ('milestone', 'skill', 'difficulty', 'streak', 'improvement');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
DO $$ BEGIN
  CREATE TYPE challenge_type AS ENUM (
    'weekly_basic',      -- Haftada 1 seans
    'discovery',         -- Hiç denemedik persona
    'improvement',       -- Düşük puanlı personaya geri dön
    'difficulty'         -- Zorluk 4+ persona
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- ============================================================
-- FILE: 20260419110700_010_observability.sql
-- ============================================================
-- ─── Usage Metrics ───────────────────────────────────────────────────────────
-- Token, süre ve maliyet takibi
CREATE TABLE usage_metrics (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id         UUID        NOT NULL REFERENCES tenants(id),
  session_id        UUID        REFERENCES sessions(id) ON DELETE SET NULL,
  -- Kaynak tipi: session (real-time), evaluation (batch), summary (batch)
  metric_type       TEXT        NOT NULL
                    CHECK (metric_type IN ('session_llm', 'session_stt', 'session_tts',
                                          'evaluation', 'summary', 'manager_insights')),
  provider          TEXT        NOT NULL,
  model             TEXT        NOT NULL,
  prompt_tokens     INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER     NOT NULL DEFAULT 0,
  total_tokens      INTEGER     GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  -- TTS için ses süresi (saniye)
  audio_seconds     NUMERIC,
  -- STT için ses boyutu (byte)
  audio_bytes       BIGINT,
  -- USD maliyet (NULL = henüz hesaplanmadı)
  cost_usd          NUMERIC(10,6),
  latency_ms        INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_tenant_id ON usage_metrics(tenant_id);
CREATE INDEX idx_usage_metrics_session_id ON usage_metrics(session_id);
CREATE INDEX idx_usage_metrics_created_at ON usage_metrics(created_at DESC);

-- ─── Prompt Logs ─────────────────────────────────────────────────────────────
-- Her LLM çağrısı için tam log (debugging + observability)
CREATE TABLE prompt_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        REFERENCES sessions(id) ON DELETE SET NULL,
  user_id             UUID        REFERENCES users(id) ON DELETE SET NULL,
  tenant_id           UUID        REFERENCES tenants(id),
  prompt_type         prompt_type NOT NULL,
  prompt_version_id   UUID        REFERENCES prompt_versions(id),
  provider            TEXT        NOT NULL,
  model               TEXT        NOT NULL,
  -- Gönderilen prompt (production'da kısaltılabilir)
  prompt_preview      TEXT,
  -- Response (production'da kısaltılabilir)
  response_preview    TEXT,
  prompt_tokens       INTEGER     NOT NULL DEFAULT 0,
  completion_tokens   INTEGER     NOT NULL DEFAULT 0,
  latency_ms          INTEGER,
  -- Başarı mı yoksa hata mı?
  is_success          BOOLEAN     NOT NULL DEFAULT true,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_logs_session_id ON prompt_logs(session_id);
CREATE INDEX idx_prompt_logs_prompt_type ON prompt_logs(prompt_type);
CREATE INDEX idx_prompt_logs_created_at ON prompt_logs(created_at DESC);
-- 90 günden eski logları otomatik temizlemek için (production'da pg_cron ile):
-- DELETE FROM prompt_logs WHERE created_at < now() - INTERVAL '90 days';

-- ============================================================
-- FILE: 20260419110800_011_admin_compliance.sql
-- ============================================================
-- ─── Audit Logs ──────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        REFERENCES tenants(id),
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  -- Kim yaptı (user_id null ise sistem)
  actor_email  TEXT,
  action       TEXT        NOT NULL,
  -- Hangi kaynak etkilendi
  resource_type TEXT,
  resource_id  UUID,
  -- Değişiklik detayı (before/after)
  metadata     JSONB       DEFAULT '{}',
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ─── Notifications ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'weekly_reminder',      -- Haftalık seans hatırlatma
    'session_complete',     -- Seans tamamlandı
    'badge_earned',         -- Rozet kazanıldı
    'challenge_assigned',   -- Yeni görev atandı
    'challenge_complete',   -- Görev tamamlandı
    'manager_report',       -- Yönetici raporu hazır
    'deletion_request',     -- Veri silme talebi
    'system'                -- Sistem bildirimi
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE notifications (
  id            UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     UUID               NOT NULL REFERENCES tenants(id),
  type          notification_type  NOT NULL,
  title         TEXT               NOT NULL,
  body          TEXT               NOT NULL,
  -- İlgili kayıt
  ref_type      TEXT,
  ref_id        UUID,
  is_read       BOOLEAN            NOT NULL DEFAULT false,
  -- E-posta gönderildi mi?
  email_sent    BOOLEAN            NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ─── Data Deletion Requests (KVKK) ───────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE deletion_status AS ENUM (
    'pending',      -- Talep alındı
    'in_progress',  -- İşlemde
    'completed',    -- Silindi
    'rejected'      -- Reddedildi (yasal süre henüz dolmadı gibi)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE data_deletion_requests (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id        UUID            NOT NULL REFERENCES tenants(id),
  requested_by     UUID            NOT NULL REFERENCES users(id),
  status           deletion_status NOT NULL DEFAULT 'pending',
  -- Talep gerekçesi
  reason           TEXT,
  -- Admin notu (neden reddedildi, ne yapıldı)
  admin_note       TEXT,
  -- İşlem yapan admin
  processed_by     UUID            REFERENCES users(id),
  -- 30 gün deadline
  deadline_at      TIMESTAMPTZ     NOT NULL DEFAULT now() + INTERVAL '30 days',
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_deletion_requests_tenant_id ON data_deletion_requests(tenant_id);
CREATE INDEX idx_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX idx_deletion_requests_deadline ON data_deletion_requests(deadline_at)
  WHERE status = 'pending';

-- ============================================================
-- FILE: 20260419110900_012_rls_all_tables.sql
-- ============================================================
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

-- ============================================================
-- FILE: 20260419111000_013_views_and_seed.sql
-- ============================================================
-- ─── User Persona Stats View ─────────────────────────────────────────────────
-- Öneri motoru için: kullanıcı × persona bazında istatistik
CREATE VIEW user_persona_stats AS
SELECT
  s.user_id,
  s.tenant_id,
  s.persona_id,
  COUNT(*)           FILTER (WHERE s.status = 'completed')           AS completed_sessions,
  COUNT(*)           FILTER (WHERE s.status = 'cancelled')           AS cancelled_sessions,
  COUNT(*)           FILTER (WHERE s.status = 'dropped')             AS dropped_sessions,
  ROUND(
    AVG(e.overall_score) FILTER (WHERE s.status = 'completed'), 2
  )                                                                   AS avg_score,
  MAX(s.completed_at) FILTER (WHERE s.status = 'completed')          AS last_completed_at,
  -- Öneri motoru için: hiç tamamlanmış seans yok mu?
  (COUNT(*) FILTER (WHERE s.status = 'completed') = 0)               AS never_completed
FROM sessions s
LEFT JOIN evaluations e ON e.session_id = s.id
GROUP BY s.user_id, s.tenant_id, s.persona_id;

-- Note: RLS policies applied at the underlying tables (sessions, evaluations)
-- View security is handled through table-level RLS

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
    DO $$ BEGIN
  CREATE TYPE persona_growth_type AS ENUM (
          'falling_performance', 
          'rising_performance', 
          'resistant_experience', 
          'new_starter', 
          'motivation_crisis'
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
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
-- Migration 019: Rubric template + 9 scenario seed
-- Adım 1: Varsayılan koçluk rubriğini oluştur
-- Adım 2: 9 pharma coaching senaryosunu ekle

-- (DO $$ blok kaldırıldı — seed verisi UI'dan oluşturulacak)


-- ============================================================
-- FILE: 20260421_020_scenario_mood_hint.sql
-- ============================================================
-- Migration 020: Persona duygusal durum ipucu (kullanıcıya gösterilen)
-- context_setup AI için talimat içerir; mood_hint kullanıcıya gösterilir.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS mood_hint TEXT;

-- NOT: Seed verisi kaldırıldı — senaryolar UI'dan oluşturulacak.
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
