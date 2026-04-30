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
-- NOT: tenant_id NULL olan orphan kullanıcılar atlanır — gamification_profiles
-- tablosunda tenant_id NOT NULL. Orphan kullanıcı varsa staging'de ayrı
-- temizlik gerekir (ya tenant ata ya sil). Aşağıdaki "DOĞRULAMA SORGULARI"
-- bölümünde orphan listesi sorgusu var.
INSERT INTO gamification_profiles (user_id, tenant_id)
SELECT u.id, u.tenant_id
FROM users u
WHERE u.tenant_id IS NOT NULL
  AND NOT EXISTS (
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
  -- Defensive: tenant_id NULL ise atla (NOT NULL constraint ihlali olmasın).
  -- users.tenant_id şemada NOT NULL ama auth trigger'da default_tenant
  -- bulunamazsa NULL gelebiliyor (orphan kullanıcı senaryosu).
  IF NEW.tenant_id IS NULL THEN
    RAISE WARNING 'auto_create_gamification_profile: tenant_id NULL — userId=%, gamification_profile atlandı', NEW.id;
    RETURN NEW;
  END IF;

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
--   -- 1. Orphan (tenant_id NULL) kullanıcılar var mı?
--   --    Bu users backfill'de atlandı, gamification çalışmaz, ayrıca
--   --    schema açısından da bozuk satırlar (NOT NULL constraint ihlali).
--   SELECT id, email, full_name, role, tenant_id, is_active, created_at
--   FROM users
--   WHERE tenant_id IS NULL;
--
--   -- 2. Çözüm A — orphan'ı bir tenant'a ata (uygun tenant_id'yi seç):
--   --    UPDATE users SET tenant_id = '<tenant-uuid>' WHERE id = '<user-uuid>';
--
--   -- 3. Çözüm B — orphan kullanıcıyı tamamen sil (auth.users + cascade):
--   --    SELECT auth.uid_delete_user('<user-uuid>'::uuid);
--   --    VEYA Supabase Dashboard → Authentication → Users → ilgili user → Delete
--
--   -- 4. Mevcut kullanıcılar için profile oluşturuldu mu?
--   SELECT
--     (SELECT COUNT(*) FROM users WHERE tenant_id IS NOT NULL) AS total_users,
--     (SELECT COUNT(*) FROM gamification_profiles) AS total_profiles;
--   -- İki sayı eşit olmalı.
--
--   -- 5. Trigger aktif mi?
--   SELECT tgname, tgenabled FROM pg_trigger
--   WHERE tgname = 'trg_auto_create_gamification_profile';
--   -- tgenabled = 'O' (origin = aktif) olmalı.
