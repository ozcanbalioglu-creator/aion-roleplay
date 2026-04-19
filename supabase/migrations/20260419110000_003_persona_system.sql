-- ─── Persona KPI standard kodu enum'u ───────────────────────────────────────
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

-- ─── Persona tip enum'ları ───────────────────────────────────────────────────
CREATE TYPE personality_type AS ENUM (
  'dominant', 'compliant', 'resistant',
  'analytical', 'expressive', 'withdrawn'
);

CREATE TYPE emotional_state AS ENUM (
  'motivated', 'demotivated', 'frustrated',
  'neutral', 'anxious', 'confident', 'burned_out'
);

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