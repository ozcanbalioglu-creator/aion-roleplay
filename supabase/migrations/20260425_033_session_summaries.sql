-- Migration 033: Session Summaries table (P2-104)
-- Her 5 mesajda bir rubric-aware özet kaydeder; chat API 40 mesaj yerine özet+son5 gönderir.

CREATE TABLE IF NOT EXISTS session_summaries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  summary_index        INTEGER NOT NULL,          -- 1-based: 1, 2, 3...
  covers_messages_from INTEGER NOT NULL,          -- Özetlenen ilk mesaj sırası (1-based)
  covers_messages_to   INTEGER NOT NULL,          -- Özetlenen son mesaj sırası
  encrypted_content    TEXT NOT NULL,             -- AES-GCM şifreli: {summary, rubric_signals}
  rubric_signals       JSONB,                     -- dimension_code → evidence[] (şifresiz, sorgu için)
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_session ON session_summaries(session_id, summary_index);

COMMENT ON TABLE session_summaries IS 'Her 5 mesajda bir oluşturulan rubric-aware özet. Chat API token maliyetini düşürmek için kullanılır.';
