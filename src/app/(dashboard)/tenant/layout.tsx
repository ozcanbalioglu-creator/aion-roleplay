import { AdminGuard } from '@/components/admin/AdminGuard'

export default function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard requiredRole="tenant_admin">
      <div className="flex flex-col gap-6">
        {children}
      </div>
    </AdminGuard>
  )
}