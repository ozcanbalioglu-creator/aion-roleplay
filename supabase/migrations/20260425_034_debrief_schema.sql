-- Migration 034: Debrief Schema (P2-105)
-- 1. session_status enum'a debrief_active + debrief_completed ekle
-- 2. debrief_messages tablosu

-- ─── 1. Enum genişletme ──────────────────────────────────────────────────────
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'debrief_active';
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'debrief_completed';

-- ─── 2. debrief_messages ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debrief_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user', 'coach')),
  encrypted_content TEXT NOT NULL,
  phase             TEXT NOT NULL DEFAULT 'intro' CHECK (phase IN ('intro', 'feedback', 'closing')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debrief_messages_session ON debrief_messages(session_id, created_at);

COMMENT ON TABLE debrief_messages IS 'Seans sonrası debrief koç sohbet geçmişi. PII maskeleme P2-106''da eklenecek.';
