-- evaluations tablosuna sesli rapor yolu ekle
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS report_audio_path TEXT;

-- report-audio özel storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-audio',
  'report-audio',
  false,
  15728640,  -- 15 MB
  ARRAY['audio/mpeg', 'audio/mp3']
)
ON CONFLICT (id) DO NOTHING;

-- Kimliği doğrulanmış kullanıcılar kendi audio dosyalarına okuma izni
-- (Asıl erişim sunucu tarafından üretilen imzalı URL üzerinden)
DROP POLICY IF EXISTS "report_audio_authenticated_read" ON storage.objects;
CREATE POLICY "report_audio_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'report-audio');

-- Service role üzerinden upload (RLS bypass) — ek policy gerekmez
