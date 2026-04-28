-- P2-002: evaluation_failed durumu + overall_score nullable

-- Eski CHECK kısıtını düşür, genişletilmiş liste ile yeniden ekle
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_status_check;
ALTER TABLE evaluations
  ADD CONSTRAINT evaluations_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'evaluation_failed'));

-- overall_score NOT NULL → nullable (evaluation_failed kaydı skor olmadan yazılabilsin)
ALTER TABLE evaluations ALTER COLUMN overall_score DROP NOT NULL;
