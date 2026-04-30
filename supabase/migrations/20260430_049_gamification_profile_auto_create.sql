-- =================================================================
-- Migration 049: gamification_profiles otomatik oluşturma
--
-- Sorun (B maddesi — RAPOR_REDESIGN_TASLAK):
--   Yeni kullanıcılar oluşturulurken gamification_profiles row'u
--   açılmıyordu. awardXPAndBadges (gamification.service.ts:84)
--   profile yoksa sessizce `xpEarned: 0` döndürüyor → Başarılarım
--   sayfası boş, hiç XP yazılmıyor, hiç rozet kazanılamıyor.
--
-- Çözüm (iki katmanlı):
--   1. BACKFILL — Mevcut kullanıcılar için eksik profile'ları oluştur.
--   2. TRIGGER — users INSERT'inde otomatik gamification_profile insert.
--
-- Kod tarafında ayrıca defensive bir upsert var (gamification.service.ts);
-- bu migration'ın asıl güvencesi. Trigger silinse veya manuel SQL ile
-- kullanıcı eklenirse de bozulmaz.
-- =================================================================

-- ─── 1. BACKFILL ──────────────────────────────────────────────────
-- Mevcut tüm kullanıcılar için profile yoksa oluştur.
INSERT INTO gamification_profiles (user_id, tenant_id)
SELECT u.id, u.tenant_id
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM gamification_profiles gp WHERE gp.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ─── 2. TRIGGER FUNCTION ──────────────────────────────────────────
-- SECURITY DEFINER: trigger users tablosuna INSERT yapan kullanıcının
-- yetkisinden bağımsız olarak gamification_profiles'a yazabilsin.
-- (RLS policy'leri zaten sistem INSERT'ine izin veriyor — gamification_system_all)
CREATE OR REPLACE FUNCTION auto_create_gamification_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO gamification_profiles (user_id, tenant_id)
  VALUES (NEW.id, NEW.tenant_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── 3. TRIGGER ───────────────────────────────────────────────────
-- AFTER INSERT — users row başarıyla yazıldıktan sonra tetiklen.
-- IF EXISTS + DROP: idempotent (migration tekrar çalıştırılabilir).
DROP TRIGGER IF EXISTS trg_auto_create_gamification_profile ON users;

CREATE TRIGGER trg_auto_create_gamification_profile
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_gamification_profile();

-- ─── 4. PostgREST schema cache reload ─────────────────────────────
-- Yeni trigger ve function'ı PostgREST'e bildir.
NOTIFY pgrst, 'reload schema';

-- ─── DOĞRULAMA SORGULARI (manuel çalıştırılır) ────────────────────
-- Migration uygulamasından sonra Supabase SQL Editor'da:
--
--   -- Mevcut kullanıcılar için profile oluşturuldu mu?
--   SELECT
--     (SELECT COUNT(*) FROM users) AS total_users,
--     (SELECT COUNT(*) FROM gamification_profiles) AS total_profiles;
--   -- İki sayı eşit olmalı.
--
--   -- Trigger aktif mi?
--   SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_auto_create_gamification_profile';
--   -- tgenabled = 'O' (origin = aktif) olmalı.
