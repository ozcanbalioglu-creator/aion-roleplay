import { PageHeader } from '@/components/admin/PageHeader'
import { UserTable } from '@/components/admin/UserTable'
import { getTenantUsers } from '@/lib/actions/user.actions'
import { getCurrentUser } from '@/lib/auth'
import { InviteUserButton } from './InviteUserButton'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const [users, currentUser] = await Promise.all([getTenantUsers(), getCurrentUser()])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcı Yönetimi"
        description="Kurumunuzdaki kullanıcıları yönetin"
        action={<InviteUserButton />}
      />
      <UserTable users={users} currentUserId={currentUser?.id ?? ''} />
    </div>
  )
}
