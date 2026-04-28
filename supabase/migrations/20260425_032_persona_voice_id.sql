-- Migration 032: Persona voice_id kolonu (P2-110)
-- Her persona için ayrı ElevenLabs voice ID (ADR-014)

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS voice_id TEXT;

COMMENT ON COLUMN personas.voice_id IS 'ElevenLabs voice ID — her persona için farklı ses. NULL ise ELEVENLABS_DEFAULT_VOICE_ID env''e düşer.';
