import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

interface AdminGuardProps {
  children: React.ReactNode
  requiredRole: 'super_admin' | 'tenant_admin'
}

export async function AdminGuard({ children, requiredRole }: AdminGuardProps) {
  const user = await getCurrentUser()
  if (!user || user.role !== requiredRole) {
    redirect('/dashboard')
  }
  return <>{children}</>
}