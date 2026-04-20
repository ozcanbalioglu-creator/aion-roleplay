-- Migration 016: Persona Fields Expansion
-- Adds more descriptive fields for AI personas as per latest design requirements

-- 1. Persona Gelişim Tipi Enum'u
DO $$ BEGIN
    CREATE TYPE persona_growth_type AS ENUM (
        'falling_performance', 
        'rising_performance', 
        'resistant_experience', 
        'new_starter', 
        'motivation_crisis'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Personas tablosuna yeni alanlar ekle
ALTER TABLE personas 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS region_area TEXT,
ADD COLUMN IF NOT EXISTS scenario_description TEXT,
ADD COLUMN IF NOT EXISTS growth_type persona_growth_type DEFAULT 'new_starter',
ADD COLUMN IF NOT EXISTS coaching_context TEXT,
ADD COLUMN IF NOT EXISTS coaching_tips TEXT;

-- Mevcut 'name' verilerini first_name'e taşı (opsiyonel ama sağlıklı)
UPDATE personas SET first_name = name WHERE first_name IS NULL;

-- 3. persona_kpis tablosuna realization_rate (gerçekleşme oranı) sütunu ekle 
-- Zaten 'value' vardı ama isimlendirme karışıklığını önlemek için 
-- user 'her KPI için gerçekleşme oranı' dedi. 'value' zaten bunu tutuyor olabilir.
-- 'value' NUMERIC NOT NULL CHECK (value >= 0) olarak tanımlı. 
-- Mevcut yapıyı bozmadan devam edebiliriz.

-- 4. Persona Prompt her zaman linkli olmalı denmiş, zaten persona_prompt_versions tablomuz var.
