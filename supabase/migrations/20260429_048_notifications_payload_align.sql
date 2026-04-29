-- Migration 048: notifications tablosunu kod beklentisiyle hizala
-- Vercel logs: "Could not find the 'payload' column of 'notifications' in the schema cache"
-- Migration 011 notifications tablosunu title/body/ref_type/ref_id ile oluşturdu
-- Migration 039 IF NOT EXISTS olduğu için payload kolonunu ekleyemedi (tablo zaten vardı)
-- Bu migration kod tarafının beklediği `payload JSONB` kolonu + yeni enum değerlerini ekler

-- ─── 1. payload kolonu ──────────────────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}';

-- ─── 2. notification_type enum'una kod tarafının beklediği değerleri ekle ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'evaluation_completed'
    AND enumtypid = 'notification_type'::regtype) THEN
    ALTER TYPE notification_type ADD VALUE 'evaluation_completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'account_created'
    AND enumtypid = 'notification_type'::regtype) THEN
    ALTER TYPE notification_type ADD VALUE 'account_created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dev_plan_ready'
    AND enumtypid = 'notification_type'::regtype) THEN
    ALTER TYPE notification_type ADD VALUE 'dev_plan_ready';
  END IF;
END$$;

-- ─── 3. PostgREST schema cache yenile ──────────────────────────────────
-- Yeni kolonu PostgREST'in hemen tanıması için
NOTIFY pgrst, 'reload schema';
