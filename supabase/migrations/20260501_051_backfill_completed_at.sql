-- =================================================================
-- Migration 051: NULL completed_at'leri backfill et
--
-- SORUN:
--   endSessionAction (eski versiyon) 'debrief_active' geçişinde
--   completed_at set etmiyordu. finishDebriefAction debrief tamam
--   olunca set ediyor — ama kullanıcı debrief'i atlarsa NULL kalıyor.
--
--   Sonuç: Dashboard query'leri (getDashboardStats, getScoreTrend,
--   getPersonaScoreComparison, getDimensionAverages, getRecentSessions,
--   getDimensionDelta) hepsi gte('completed_at', since) veya
--   order('completed_at') kullandığı için NULL satırlar eleniyor →
--   "Tamamlanan Seans=0", "Ort. Koçluk Puanı=—", boş grafikler.
--
-- ÇÖZÜM (kalıcı + backfill):
--   1. Kalıcı fix: endSessionAction'a completed_at: new Date() eklendi
--      (kod commit'inde — bu migration'dan önce deploy olmalı)
--   2. Backfill: mevcut NULL satırlar için started_at + duration_seconds
--      ile yaklaşık değer hesapla
--
-- Veri kaybı yok, sıfır downtime.
-- =================================================================

-- Backfill: completed_at NULL ve status terminal (completed/debrief_*)
-- olan satırlarda yaklaşık zamanı hesapla.
UPDATE sessions
SET completed_at = COALESCE(
  -- Tercih sırası:
  -- 1. started_at + duration_seconds (en hassas)
  CASE
    WHEN started_at IS NOT NULL AND duration_seconds IS NOT NULL
    THEN started_at + (duration_seconds || ' seconds')::interval
  END,
  -- 2. cancelled_at (yarıda kesilen seans için)
  cancelled_at,
  -- 3. updated_at (son çare)
  updated_at,
  -- 4. created_at (gerçekten son çare)
  created_at
)
WHERE completed_at IS NULL
  AND status IN ('completed', 'debrief_active', 'debrief_completed', 'failed', 'cancelled');
-- NOT: 'evaluation_failed' burada YOK — o değer evaluations.status enum'unda,
-- sessions.status enum'unda değil. Sessions tablosu için yukarıdaki 5 terminal
-- durum yeterli.

-- Doğrulama (manuel SQL Editor'da):
--
--   SELECT status, COUNT(*) AS adet,
--          COUNT(completed_at) AS completed_at_doldurulmus,
--          COUNT(*) - COUNT(completed_at) AS hala_null
--   FROM sessions
--   GROUP BY status
--   ORDER BY status;
--
--   Beklenen: terminal status'lı tüm satırlarda completed_at dolu.
--   'pending' ve 'active' status'larda doğal olarak NULL kalır (henüz bitmemiş).
