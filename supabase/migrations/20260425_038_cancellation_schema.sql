-- P2-103: cancelled_at kolonu + P2-102'de kullanılan 4 yeni reason değeri

-- Enum'a yeni değerler ekle (ADD VALUE IF NOT EXISTS Postgres 9.1+ destekli)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'technical_issue'
    AND enumtypid = 'cancellation_reason'::regtype) THEN
    ALTER TYPE cancellation_reason ADD VALUE 'technical_issue';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'persona_wrong_fit'
    AND enumtypid = 'cancellation_reason'::regtype) THEN
    ALTER TYPE cancellation_reason ADD VALUE 'persona_wrong_fit';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scenario_too_hard'
    AND enumtypid = 'cancellation_reason'::regtype) THEN
    ALTER TYPE cancellation_reason ADD VALUE 'scenario_too_hard';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_interrupted'
    AND enumtypid = 'cancellation_reason'::regtype) THEN
    ALTER TYPE cancellation_reason ADD VALUE 'user_interrupted';
  END IF;
END$$;

-- cancelled_at kolonu (action bunu zaten yazıyor, kolonu ekle)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
