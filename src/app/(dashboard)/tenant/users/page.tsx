import { PageHeader } from '@/components/admin/PageHeader'
import { UserTable } from '@/components/admin/UserTable'
import { BulkUploadSheet } from '@/components/admin/BulkUploadSheet'
import { getTenantUsers } from '@/lib/actions/user.actions'
import { getCurrentUser } from '@/lib/auth'
import { features } from '@/lib/features'
import { InviteUserButton } from './InviteUserButton'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const [users, currentUser] = await Promise.all([getTenantUsers(), getCurrentUser()])
  const canManage = currentUser?.role === 'tenant_admin' || currentUser?.role === 'super_admin'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcı Yönetimi"
        description="Kurumunuzdaki kullanıcıları yönetin"
        action={
          canManage ? (
            <div className="flex gap-2">
              {features.bulkUpload && <BulkUploadSheet />}
              <InviteUserButton />
            </div>
          ) : undefined
        }
      />
      <UserTable users={users} currentUserId={currentUser?.id ?? ''} canManage={canManage} />
    </div>
  )
}
