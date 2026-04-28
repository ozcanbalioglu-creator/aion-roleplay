-- Add session_mode column to sessions table if it doesn't exist
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_mode TEXT NOT NULL DEFAULT 'text'
    CHECK (session_mode IN ('text', 'voice'));
