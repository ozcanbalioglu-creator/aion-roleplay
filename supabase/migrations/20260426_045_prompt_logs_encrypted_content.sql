-- prompt_logs tablosuna encrypted_content kolonu ekle
-- activateSessionAction şifreli sistem promptunu buraya kaydediyor
ALTER TABLE prompt_logs
  ADD COLUMN IF NOT EXISTS encrypted_content TEXT;
