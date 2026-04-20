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
