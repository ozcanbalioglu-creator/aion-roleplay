-- Migration 018: Scenarios table alignment
-- Kod tarafı difficulty_level, target_skills, context_setup, estimated_duration_min
-- kullanırken tablo bunları eksik tutuyordu. Bu migration düzeltiyor.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS difficulty_level     SMALLINT DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS target_skills        TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS context_setup        TEXT,
  ADD COLUMN IF NOT EXISTS estimated_duration_min SMALLINT DEFAULT 15;

-- Eğer eski 'difficulty' kolonu varsa değerlerini taşı
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenarios' AND column_name = 'difficulty'
  ) THEN
    UPDATE scenarios
    SET difficulty_level = difficulty::SMALLINT
    WHERE difficulty_level IS NULL OR difficulty_level = 3;
  END IF;
END $$;

-- target_skill_codes varsa target_skills'e kopyala
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenarios' AND column_name = 'target_skill_codes'
  ) THEN
    UPDATE scenarios
    SET target_skills = target_skill_codes
    WHERE target_skills = '{}' OR target_skills IS NULL;
  END IF;
END $$;
