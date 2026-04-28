import { AdminGuard } from '@/components/admin/AdminGuard'

export default function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard allowedRoles={['tenant_admin', 'super_admin', 'hr_admin', 'manager']}>
      <div className="flex flex-col gap-6 px-4 pb-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </AdminGuard>
  )
}
