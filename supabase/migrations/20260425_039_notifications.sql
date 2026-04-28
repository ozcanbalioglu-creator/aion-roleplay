-- P2-001: Bildirimler tablosu

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES tenants(id),
  type       TEXT        NOT NULL CHECK (type IN (
               'evaluation_completed', 'account_created', 'dev_plan_ready'
             )),
  payload    JSONB       NOT NULL DEFAULT '{}',
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  email_sent BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own_select" ON notifications;
CREATE POLICY "notifications_own_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
CREATE POLICY "notifications_own_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
