import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_ROUTES = [
  '/login',
  '/auth/callback',
  '/api/health'
]

const CONSENT_ROUTE = '/consent'

const ADMIN_ONLY_ROUTES = ['/admin/tenants', '/admin/personas', '/admin/prompts', '/admin/system']
const MANAGER_ROUTES = ['/manager']
const ADMIN_ROUTES = ['/admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Statik dosyalar ve API health'i geç
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    const { supabaseResponse } = await updateSession(request)
    return supabaseResponse
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Giriş yapılmamış → /login
  if (!user) {
    if (pathname !== '/login') {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return supabaseResponse
  }

  // Giriş yapılmış + /login → /dashboard
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const role = user.user_metadata?.role as string | undefined

  // Consent sayfası: sadece giriş yapmış kullanıcı erişebilir
  if (pathname === CONSENT_ROUTE) {
    return supabaseResponse
  }

  // Role-based coarse protection
  if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
    if (role !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    if (!role || !['super_admin', 'tenant_admin'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (MANAGER_ROUTES.some(r => pathname.startsWith(r))) {
    if (!role || !['super_admin', 'tenant_admin', 'hr_admin', 'manager'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
