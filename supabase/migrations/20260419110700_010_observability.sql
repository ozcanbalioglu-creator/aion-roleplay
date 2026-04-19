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