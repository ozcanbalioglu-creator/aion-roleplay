-- Migration 017: Persona fields expansion
-- Adds descriptive columns used by the application that are missing from the base schema

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS first_name          TEXT,
  ADD COLUMN IF NOT EXISTS last_name           TEXT,
  ADD COLUMN IF NOT EXISTS surname             TEXT,
  ADD COLUMN IF NOT EXISTS department          TEXT,
  ADD COLUMN IF NOT EXISTS location            TEXT,
  ADD COLUMN IF NOT EXISTS experience_years    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scenario_description TEXT,
  ADD COLUMN IF NOT EXISTS coaching_context    TEXT,
  ADD COLUMN IF NOT EXISTS coaching_tips       TEXT[] DEFAULT '{}';

-- Backfill first_name from name for existing rows
UPDATE personas SET first_name = name WHERE first_name IS NULL AND name IS NOT NULL;
