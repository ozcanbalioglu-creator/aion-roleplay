-- 047_cancellation_reason_natural_end.sql
-- cancellation_reason enum'una 'user_ended' ve 'ai_ended' değerleri eklenir.
-- endSessionAction bu değerleri yazmaya çalıştığında DB hata veriyordu ("Seans tamamlanamadı" toast).
-- Bu değerler aslında "kapatma sebebi" değil, "doğal bitiş kaynağı" — analitikte gerekli.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_ended'
    AND enumtypid = 'cancellation_reason'::regtype) THEN
    ALTER TYPE cancellation_reason ADD VALUE 'user_ended';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ai_ended'
    AND enumtypid = 'cancellation_reason'::regtype) THEN
    ALTER TYPE cancellation_reason ADD VALUE 'ai_ended';
  END IF;
END $$;

-- PostgREST cache yenile
NOTIFY pgrst, 'reload schema';
