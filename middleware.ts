import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_ROUTES = [
  '/login',
  '/auth/callback',
  '/api/health'
]

// Public landing — tam eşleşme. Authenticated user `/` -> `/dashboard`'a yönlendirilir.
const PUBLIC_LANDING_PATH = '/'

const CONSENT_ROUTE = '/consent'

// Sadece super_admin
const SUPER_ADMIN_ROUTES = ['/admin/tenants', '/admin/personas', '/admin/prompts', '/admin/system', '/admin/rubrics']
// super_admin veya tenant_admin
const ADMIN_ROUTES = ['/admin', '/tenant']
// Manager ve üstü
const MANAGER_ROUTES = ['/manager']

const ROLE_PROTECTED_ROUTES: Record<string, string[]> = {
  '/reports': ['manager', 'hr_viewer', 'tenant_admin', 'super_admin'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Statik dosyalar ve API health'i geç
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    const { supabaseResponse } = await updateSession(request)
    return supabaseResponse
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Public landing (`/`) — auth durumuna göre davran:
  //  - giriş yapmış kullanıcı doğrudan dashboard'a
  //  - giriş yapmamış kullanıcı landing'i görsün
  if (pathname === PUBLIC_LANDING_PATH) {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

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
  if (SUPER_ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    if (role !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (pathname.startsWith('/tenant/users')) {
    if (!role || !['super_admin', 'tenant_admin', 'hr_admin', 'manager'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } else if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    if (!role || !['super_admin', 'tenant_admin'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (MANAGER_ROUTES.some(r => pathname.startsWith(r))) {
    if (!role || !['super_admin', 'tenant_admin', 'hr_admin', 'manager'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  for (const [route, allowedRoles] of Object.entries(ROLE_PROTECTED_ROUTES)) {
    if (pathname.startsWith(route) && (!role || !allowedRoles.includes(role))) {
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
