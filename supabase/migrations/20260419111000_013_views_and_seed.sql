-- ─── User Persona Stats View ─────────────────────────────────────────────────
-- Öneri motoru için: kullanıcı × persona bazında istatistik
CREATE VIEW user_persona_stats AS
SELECT
  s.user_id,
  s.tenant_id,
  s.persona_id,
  COUNT(*)           FILTER (WHERE s.status = 'completed')           AS completed_sessions,
  COUNT(*)           FILTER (WHERE s.status = 'cancelled')           AS cancelled_sessions,
  COUNT(*)           FILTER (WHERE s.status = 'dropped')             AS dropped_sessions,
  ROUND(
    AVG(e.overall_score) FILTER (WHERE s.status = 'completed'), 2
  )                                                                   AS avg_score,
  MAX(s.completed_at) FILTER (WHERE s.status = 'completed')          AS last_completed_at,
  -- Öneri motoru için: hiç tamamlanmış seans yok mu?
  (COUNT(*) FILTER (WHERE s.status = 'completed') = 0)               AS never_completed
FROM sessions s
LEFT JOIN evaluations e ON e.session_id = s.id
GROUP BY s.user_id, s.tenant_id, s.persona_id;

-- Note: RLS policies applied at the underlying tables (sessions, evaluations)
-- View security is handled through table-level RLS