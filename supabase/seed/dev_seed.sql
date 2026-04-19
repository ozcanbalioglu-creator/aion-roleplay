-- ─── Test Tenant ─────────────────────────────────────────────────────────────
INSERT INTO tenants (id, name, slug, brand_color, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Şirket A.Ş.',
  'demo-sirket',
  '#4F46E5',
  true
) ON CONFLICT (id) DO NOTHING;

-- ─── Test Kullanıcıları (Supabase Auth + profile trigger) ────────────────────
-- NOT: Gerçek şifre hash'ini Supabase admin API ile oluşturun.
-- Bu seed dosyası yalnızca profile tablosunu doldurur.
-- Auth kullanıcıları Supabase Dashboard > Authentication > Users'dan ekleyin.
