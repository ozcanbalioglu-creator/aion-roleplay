# Geliştirme (Dev) Kullanıcıları Kurulumu

Projenin auth sistemi role-based (rol bazlı) ve multi-tenant yapısındadır. Veritabanına elle eklediğimiz kullanıcıları test edebilmek için Supabase Dashboard üzerinden aşağıdaki test hesaplarını açmanız gerekir:

## Adım Adım Kurulum

1. Supabase kontrol panelinize girip **Authentication > Users** sayfasına gidin.
2. "Add User" (Create new user) butonuna basarak alttaki kullanıcıları oluşturun:
3. Her bir kullanıcıyı oluşturduktan sonra tablodan tıklayarak (ya da üç nokta menüsünden) "Edit User" deyin.
4. **User Metadata (JSON)** bölümüne belirtilen JSON blocklarını tam olarak yapıştırıp kaydedin. (Kaydettiğiniz an veritabanı Trigger'ımız `users` tablosunda o profil kaydını otomatik açacaktır).

### Test Hesapları

| Email | Password | Metadata (Kopyala/Yapıştır) |
|---|---|---|
| super@test.com | `Test1234!` | `{"role": "super_admin", "full_name": "Test Super Admin", "tenant_id": "00000000-0000-0000-0000-000000000001"}` |
| admin@test.com | `Test1234!` | `{"role": "tenant_admin", "full_name": "Test Tenant Admin", "tenant_id": "00000000-0000-0000-0000-000000000001"}` |
| manager@test.com | `Test1234!` | `{"role": "manager", "full_name": "Test Manager", "tenant_id": "00000000-0000-0000-0000-000000000001"}` |
| hr@test.com | `Test1234!` | `{"role": "hr_admin", "full_name": "Test HR", "tenant_id": "00000000-0000-0000-0000-000000000001"}` |
| user@test.com | `Test1234!` | `{"role": "user", "full_name": "Test User", "tenant_id": "00000000-0000-0000-0000-000000000001"}` |
