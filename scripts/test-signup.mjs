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
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('HATA: .env.local eksik.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  const email = 'demo@example.com'
  const password = 'password123'
  const tenantId = '00000000-0000-0000-0000-000000000001'

  console.log(`Kayit denemesi: ${email}...`)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Demo Kullanıcı',
        role: 'manager',
        tenant_id: tenantId
      }
    }
  })

  if (error) {
    console.error('HATA:', error.message)
    if (error.message.includes('Database error')) {
      console.log('--- DB Trigger Hatası Tespit Edildi ---')
      console.log('Muhtemelen: role enum veya tenant_id cast sorunu.')
    }
  } else {
    console.log('✅ Basarili! ID:', data.user.id)
    console.log('Simdi giris yapabilirsiniz.')
  }
}

main()
