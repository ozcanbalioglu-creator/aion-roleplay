import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// .env.local dosyasını manuel parse et
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('='))
    .map(([key, value]) => [key, value?.trim()])
)

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('HATA: .env.local içinde NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY bulunamadı.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const TEST_EMAIL = 'demo@example.com'
const TEST_PASSWORD = 'password123'
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function main() {
  console.log(`Kullanıcı oluşturuluyor: ${TEST_EMAIL}...`)

  // 1. Auth kullanıcısı oluştur
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Demo Kullanıcı',
      role: 'manager',
      tenant_id: TEST_TENANT_ID
    }
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('Kullanıcı zaten mevcut, profil kontrol ediliyor...')
    } else {
      console.error('Auth kullanıcısı oluşturulamadı:', authError)
      return
    }
  }

  // Kullanıcı ID'sini al (yeni veya mevcut)
  let userId
  if (authData?.user) {
    userId = authData.user.id
  } else {
    const { data: users } = await supabase.auth.admin.listUsers()
    const existingUser = users.users.find(u => u.email === TEST_EMAIL)
    if (!existingUser) {
      console.error('Kullanıcı bulunamadı.')
      return
    }
    userId = existingUser.id
  }

  // 2. Profile (users tablosu) oluştur/güncelle
  const { error: profileError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      tenant_id: TEST_TENANT_ID,
      email: TEST_EMAIL,
      full_name: 'Demo Kullanıcı',
      role: 'manager',
      is_active: true
    })

  if (profileError) {
    console.error('Profil oluşturulamadı:', profileError)
  } else {
    console.log('✅ Başarılı! Giris bilgileri:')
    console.log('---------------------------')
    console.log(`E-posta: ${TEST_EMAIL}`)
    console.log(`Şifre: ${TEST_PASSWORD}`)
    console.log('---------------------------')
  }
}

main()
