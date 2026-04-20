-- ─── Role enum ───────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'tenant_admin',
  'hr_admin',
  'manager',
  'user'
);

-- ─── Tenants ─────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  logo_url      TEXT,
  brand_color   TEXT        DEFAULT '#4F46E5',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug format kontrolü: sadece küçük harf, rakam, tire
ALTER TABLE tenants
  ADD CONSTRAINT tenants_slug_format
  CHECK (slug ~ '^[a-z0-9-]+$');

-- ─── Users (profile table, auth.users ile 1:1) ───────────────────────────────
CREATE TABLE users (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'user',
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  avatar_url    TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- ─── KVKK Consent Records ────────────────────────────────────────────────────
CREATE TABLE consent_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id        UUID        NOT NULL REFERENCES tenants(id),
  consented_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_version  TEXT        NOT NULL DEFAULT '1.0',
  ip_address       TEXT,
  user_agent       TEXT
);

CREATE INDEX idx_consent_user_id ON consent_records(user_id);

-- ─── Updated_at trigger function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Auto-create user profile on auth.users insert ───────────────────────────
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- İlk bulduğu aktif tenant'ı al (fallback için)
  SELECT id INTO default_tenant_id FROM public.tenants WHERE is_active = true LIMIT 1;

  INSERT INTO public.users (id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'user'::public.user_role),
    COALESCE((NEW.raw_user_meta_data->>'tenant_id')::UUID, default_tenant_id)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
