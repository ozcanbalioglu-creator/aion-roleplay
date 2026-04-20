import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// .env.local parse
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
    })
)

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('HATA: .env.local eksik.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function createTestUser(email, password, role, fullName) {
  console.log(`Kullanıcı oluşturuluyor: ${email} (${role})...`)
  
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: role,
      tenant_id: TEST_TENANT_ID
    }
  })

  if (error) {
    if (error.message.includes('already registered')) {
      console.log(`[!] ${email} zaten mevcut.`);
    } else {
      console.error(`[X] ${email} hatası:`, error.message);
    }
  } else {
    console.log(`[V] ${email} başarıyla oluşturuldu. ID: ${data.user.id}`);
  }
}

async function main() {
  // 1. Super Admin
  await createTestUser('admin@aion.com', 'aion12345', 'super_admin', 'Sistem Admini');
  
  // 2. Demo User (Manager)
  await createTestUser('kullanici@aion.com', 'aion12345', 'manager', 'Demo Kullanıcı');

  console.log('\n--- GİRİŞ BİLGİLERİ ---');
  console.log('Admin: admin@aion.com / aion12345');
  console.log('User:  kullanici@aion.com / aion12345');
}

main()
