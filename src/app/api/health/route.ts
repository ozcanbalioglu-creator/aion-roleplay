import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const checks: Record<string, boolean | string> = {}

  // Check Supabase connection
  try {
    const supabase = await createClient()
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

  // Check AI providers configured
  checks.llm_provider = process.env.OPENAI_API_KEY ? true : 'OPENAI_API_KEY missing'
  checks.tts_provider = process.env.ELEVENLABS_API_KEY ? true : 'ELEVENLABS_API_KEY missing'
  checks.stt_provider = process.env.OPENAI_API_KEY ? true : 'OPENAI_API_KEY missing'

  const allOk = Object.values(checks).every(v => v === true)

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      env: process.env.APP_ENV ?? 'unknown',
      timestamp: new Date().toISOString(),
      checks
    },
    { status: allOk ? 200 : 503 }
  )
}
