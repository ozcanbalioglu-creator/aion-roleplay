import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Super admin guard — sadece super_admin erişebilir
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role as string | undefined

  if (!user || role !== 'super_admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const checks: Record<string, boolean | string> = {}

  // Check Supabase connection
  try {
    const { error } = await supabase.from('tenants').select('count').limit(1)
    checks.supabase = error ? `error: ${error.message}` : true
  } catch (e) {
    checks.supabase = `error: ${e instanceof Error ? e.message : 'unknown'}`
  }

  // Check encryption key
  try {
    const key = process.env.ENCRYPTION_KEY
    checks.encryption = key?.length === 64 ? true : 'ENCRYPTION_KEY invalid'
  } catch {
    checks.encryption = 'error'
  }

  // Check AI providers configured (functional check — çalışıyor mu)
  checks.llm_provider = process.env.OPENAI_API_KEY ? true : 'OPENAI_API_KEY missing'
  checks.tts_provider = process.env.ELEVENLABS_API_KEY ? true : 'ELEVENLABS_API_KEY missing'
  checks.stt_provider = process.env.OPENAI_API_KEY ? true : 'OPENAI_API_KEY missing'

  // Env probe — sadece set/unset, değerleri ifşa etme
  const envProbe = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
    UPSTASH_QSTASH_TOKEN: !!process.env.UPSTASH_QSTASH_TOKEN,
    UPSTASH_QSTASH_CURRENT_SIGNING_KEY: !!process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY,
    UPSTASH_QSTASH_NEXT_SIGNING_KEY: !!process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY,
    QSTASH_RECEIVER_URL: !!process.env.QSTASH_RECEIVER_URL,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
    APP_ENV: process.env.APP_ENV ?? 'unset',
  }

  const allOk = Object.values(checks).every(v => v === true)

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      env: envProbe,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  )
}
