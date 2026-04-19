-- ─── Audit Logs ──────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        REFERENCES tenants(id),
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  -- Kim yaptı (user_id null ise sistem)
  actor_email  TEXT,
  action       TEXT        NOT NULL,
  -- Hangi kaynak etkilendi
  resource_type TEXT,
  resource_id  UUID,
  -- Değişiklik detayı (before/after)
  metadata     JSONB       DEFAULT '{}',
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ─── Notifications ───────────────────────────────────────────────────────────
CREATE TYPE notification_type AS ENUM (
  'weekly_reminder',      -- Haftalık seans hatırlatma
  'session_complete',     -- Seans tamamlandı
  'badge_earned',         -- Rozet kazanıldı
  'challenge_assigned',   -- Yeni görev atandı
  'challenge_complete',   -- Görev tamamlandı
  'manager_report',       -- Yönetici raporu hazır
  'deletion_request',     -- Veri silme talebi
  'system'                -- Sistem bildirimi
);

CREATE TABLE notifications (
  id            UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     UUID               NOT NULL REFERENCES tenants(id),
  type          notification_type  NOT NULL,
  title         TEXT               NOT NULL,
  body          TEXT               NOT NULL,
  -- İlgili kayıt
  ref_type      TEXT,
  ref_id        UUID,
  is_read       BOOLEAN            NOT NULL DEFAULT false,
  -- E-posta gönderildi mi?
  email_sent    BOOLEAN            NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ─── Data Deletion Requests (KVKK) ───────────────────────────────────────────
CREATE TYPE deletion_status AS ENUM (
  'pending',      -- Talep alındı
  'in_progress',  -- İşlemde
  'completed',    -- Silindi
  'rejected'      -- Reddedildi (yasal süre henüz dolmadı gibi)
);

CREATE TABLE data_deletion_requests (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id        UUID            NOT NULL REFERENCES tenants(id),
  requested_by     UUID            NOT NULL REFERENCES users(id),
  status           deletion_status NOT NULL DEFAULT 'pending',
  -- Talep gerekçesi
  reason           TEXT,
  -- Admin notu (neden reddedildi, ne yapıldı)
  admin_note       TEXT,
  -- İşlem yapan admin
  processed_by     UUID            REFERENCES users(id),
  -- 30 gün deadline
  deadline_at      TIMESTAMPTZ     NOT NULL DEFAULT now() + INTERVAL '30 days',
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_deletion_requests_tenant_id ON data_deletion_requests(tenant_id);
CREATE INDEX idx_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX idx_deletion_requests_deadline ON data_deletion_requests(deadline_at)
  WHERE status = 'pending';