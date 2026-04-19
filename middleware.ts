import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/auth/callback']

// Routes that require specific roles (beyond being authenticated)
const ADMIN_ROUTES = ['/admin']
const MANAGER_ROUTES = ['/manager']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    const { supabaseResponse } = await updateSession(request)
    return supabaseResponse
  }

  // Refresh session and get user
  const { supabaseResponse, user } = await updateSession(request)

  // No user → redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-based route protection
  // Note: Full role checking is done inside route handlers via RLS
  // Middleware only handles coarse-grained redirects
  const role = user.user_metadata?.role as string | undefined

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
