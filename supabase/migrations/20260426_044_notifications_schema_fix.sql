-- title + body kolonları ekle (NotificationPoller bunları seçiyor)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body  TEXT;

-- notification_type enum'una yeni değerler ekle (IF NOT EXISTS PostgreSQL 14+)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'badge_earned'
    AND enumtypid = 'notification_type'::regtype) THEN
    ALTER TYPE notification_type ADD VALUE 'badge_earned';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'challenge_completed'
    AND enumtypid = 'notification_type'::regtype) THEN
    ALTER TYPE notification_type ADD VALUE 'challenge_completed';
  END IF;
END$$;
