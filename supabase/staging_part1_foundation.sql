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
