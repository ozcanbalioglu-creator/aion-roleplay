-- 046_session_messages_align.sql
-- session_messages tablosunu uygulama kodu ile hizala.
-- message.service.ts şu kolonları kullanıyor: role, content (şifreli), phase, metadata, sequence_number, session_id
-- Ancak migration 007'de tablo content_encrypted ile oluşturulmuş; sequence_number ve metadata hiç eklenmemiş.
-- Bu uyumsuzluk chat geçmişinin kaydedilmemesine ve AI'ın bağlamı kaybetmesine yol açıyor.

-- 1) content kolonu — varsa atla; content_encrypted varsa rename; ikisi de yoksa ekle.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_messages' AND column_name = 'content'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'session_messages' AND column_name = 'content_encrypted'
    ) THEN
      EXECUTE 'ALTER TABLE session_messages RENAME COLUMN content_encrypted TO content';
    ELSE
      EXECUTE 'ALTER TABLE session_messages ADD COLUMN content TEXT NOT NULL DEFAULT '''' ';
    END IF;
  END IF;
END $$;

-- 2) metadata kolonu (mesaj bazında metadata, ör. latency_ms)
ALTER TABLE session_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3) sequence_number kolonu — session içinde monotonik artan
ALTER TABLE session_messages
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- Mevcut satırlar için sequence_number'ı created_at sırasına göre doldur
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at, id) AS seq
  FROM session_messages
  WHERE sequence_number IS NULL
)
UPDATE session_messages sm
SET sequence_number = n.seq
FROM numbered n
WHERE sm.id = n.id;

-- 4) Insert sırasında sequence_number'ı otomatik üret
CREATE OR REPLACE FUNCTION set_session_message_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequence_number IS NULL THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1
    INTO NEW.sequence_number
    FROM session_messages
    WHERE session_id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_message_sequence ON session_messages;
CREATE TRIGGER trg_session_message_sequence
  BEFORE INSERT ON session_messages
  FOR EACH ROW EXECUTE FUNCTION set_session_message_sequence();

-- 5) Sıralama için index
CREATE INDEX IF NOT EXISTS idx_session_messages_seq
  ON session_messages(session_id, sequence_number);

-- 6) PostgREST schema cache yenile
NOTIFY pgrst, 'reload schema';
