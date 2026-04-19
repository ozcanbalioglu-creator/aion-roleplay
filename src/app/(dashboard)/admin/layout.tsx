import { AdminGuard } from '@/components/admin/AdminGuard'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard requiredRole="super_admin">
      <div className="flex flex-col gap-6">
        {children}
      </div>
    </AdminGuard>
  )
}