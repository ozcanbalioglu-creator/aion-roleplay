-- Migration 030: Persona isim alanlarını tekleştir
-- first_name + surname → name (tam isim), last_name kaldır

-- 1. Bağımlı view'ı düşür
DROP VIEW IF EXISTS tenant_available_personas;

-- 2. name alanını tam isimle güncelle (first_name varsa onu, yoksa mevcut name'i kullan)
UPDATE personas
SET name = TRIM(
  COALESCE(first_name, name)
  || CASE WHEN surname IS NOT NULL AND surname != '' THEN ' ' || surname ELSE '' END
);

-- 3. Gereksiz kolonları kaldır
ALTER TABLE personas
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS surname;

-- 4. View'ı surname olmadan yeniden oluştur
CREATE OR REPLACE VIEW tenant_available_personas AS
SELECT DISTINCT
  p.id,
  p.name,
  p.title,
  p.difficulty,
  p.personality_type,
  p.emotional_baseline,
  p.is_active,
  p.avatar_image_url,
  ptm.tenant_id,
  ptm.assigned_at
FROM personas p
INNER JOIN persona_tenant_mapping ptm ON p.id = ptm.persona_id
WHERE ptm.is_active = true AND p.is_active = true
ORDER BY ptm.assigned_at DESC;
