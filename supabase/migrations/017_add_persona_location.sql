-- Migration 017: Add location field to personas table

ALTER TABLE personas ADD COLUMN IF NOT EXISTS location TEXT;
