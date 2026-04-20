import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

interface AdminGuardProps {
  children: React.ReactNode
  /** Tek rol kontrolü (geriye uyumluluk) */
  requiredRole?: UserRole
  /** Birden fazla rolle izin ver */
  allowedRoles?: UserRole[]
}

export async function AdminGuard({ children, requiredRole, allowedRoles }: AdminGuardProps) {
  const user = await getCurrentUser()

  const roles: UserRole[] = allowedRoles ?? (requiredRole ? [requiredRole] : [])
  if (!user || !roles.includes(user.role)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}