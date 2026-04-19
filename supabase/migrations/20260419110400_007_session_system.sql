-- ─── Session durum enum'ları ─────────────────────────────────────────────────
CREATE TYPE session_status AS ENUM (
  'pending', 'active', 'completed', 'cancelled', 'dropped', 'failed'
);

CREATE TYPE session_phase AS ENUM (
  'opening', 'exploration', 'deepening', 'action', 'closing'
);

CREATE TYPE cancellation_reason AS ENUM (
  'manual_cancel', 'drop_off', 'technical_failure'
);

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