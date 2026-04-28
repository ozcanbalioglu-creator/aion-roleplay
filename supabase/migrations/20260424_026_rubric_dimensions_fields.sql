-- Migration 026: rubric_dimensions tablosuna eksik kolonlar ekleniyor
-- RubricDimensionCard bileşeni ve updateRubricDimensionAction bu kolonları kullanıyor.

ALTER TABLE rubric_dimensions
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS weight      NUMERIC      NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN      NOT NULL DEFAULT true;
