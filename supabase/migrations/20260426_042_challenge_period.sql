-- 042: Challenge period (weekly/monthly) + reminder tracking
-- Idempotent — Supabase SQL Editor'a güvenle yapıştırılabilir.

-- challenges: period alanı
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'weekly'
    CHECK (period IN ('weekly', 'monthly'));

-- Mevcut is_weekly=true olanları weekly olarak işaretle (zaten default, ama explicit)
UPDATE challenges SET period = 'weekly' WHERE is_weekly = true AND period IS NULL;

-- user_challenges: reminder dedup için
ALTER TABLE user_challenges
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
