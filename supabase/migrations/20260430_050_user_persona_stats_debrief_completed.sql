-- =================================================================
-- Migration 050: user_persona_stats VIEW — debrief_completed dahil et
--
-- SORUN (B3 — Persona "İlk Kez" filtresi yanlış sayaç):
--   Yeni debrief akışında seans 'completed' yerine 'debrief_completed'
--   durumunda bitiyor. Mevcut user_persona_stats VIEW'ı sadece
--   's.status = completed' filter ettiği için yeni akış seansları
--   completed_sessions=0 görünüyor → never_completed=true →
--   UI persona kartlarında "İlk kez dene" rozeti yanlış pozitif.
--
-- ÇÖZÜM:
--   VIEW'ı yeniden tanımla; tüm 'completed' filter'larını
--   IN ('completed', 'debrief_completed') olarak genişlet.
--
-- Bu sadece bir VIEW — REPLACE etmek için DROP + CREATE.
-- Veri kaybı yok, downtime sıfır (PostgreSQL VIEW REPLACE).
-- =================================================================

DROP VIEW IF EXISTS user_persona_stats;

CREATE VIEW user_persona_stats AS
SELECT
  s.user_id,
  s.tenant_id,
  s.persona_id,
  COUNT(*) FILTER (WHERE s.status IN ('completed', 'debrief_completed')) AS completed_sessions,
  COUNT(*) FILTER (WHERE s.status = 'cancelled')                          AS cancelled_sessions,
  COUNT(*) FILTER (WHERE s.status = 'dropped')                            AS dropped_sessions,
  ROUND(
    AVG(e.overall_score) FILTER (WHERE s.status IN ('completed', 'debrief_completed')), 2
  )                                                                       AS avg_score,
  MAX(s.completed_at) FILTER (WHERE s.status IN ('completed', 'debrief_completed'))
                                                                          AS last_completed_at,
  -- Öneri motoru: hiç tamamlanmış seans yok mu?
  (COUNT(*) FILTER (WHERE s.status IN ('completed', 'debrief_completed')) = 0)
                                                                          AS never_completed
FROM sessions s
LEFT JOIN evaluations e ON e.session_id = s.id
GROUP BY s.user_id, s.tenant_id, s.persona_id;

-- PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Doğrulama (manuel, SQL Editor'da):
--
--   SELECT user_id, persona_id, completed_sessions, never_completed
--   FROM user_persona_stats
--   WHERE user_id = (SELECT id FROM users WHERE email = 'ozcanbalioglu@hotmail.com');
--
--   completed_sessions > 0 ve never_completed = false olmalı.
