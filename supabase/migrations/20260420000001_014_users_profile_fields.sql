-- Add extended profile fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS title      TEXT,
  ADD COLUMN IF NOT EXISTS position   TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS username   TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
