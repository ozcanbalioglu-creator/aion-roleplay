import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

function buildRedirect(user: User, origin: string, next: string | null): NextResponse {
  const role = user.user_metadata?.role as string | undefined
  const defaultNext =
    role === 'super_admin' ? '/admin' :
    role === 'tenant_admin' ? '/tenant' :
    '/dashboard'
  return NextResponse.redirect(`${origin}${next ?? defaultNext}`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const next       = searchParams.get('next')

  const supabase = await createClient()

  // PKCE flow — OTP magic link ve bazı provider callback'leri
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      return buildRedirect(data.user, origin, next)
    }
  }

  // token_hash flow — inviteUserByEmail, email confirmation, recovery linkleri
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change',
    })
    if (!error && data.user) {
      return buildRedirect(data.user, origin, next)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
