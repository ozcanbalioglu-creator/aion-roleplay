import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/admin/PageHeader'
import { ScenarioTable } from './ScenarioTable'
import { getScenarios } from '@/lib/actions/scenario.actions'
import { getCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ScenariosPage() {
  const [user, scenarios] = await Promise.all([getCurrentUser(), getScenarios()])
  if (!user) redirect('/login')

  const isSuperAdmin = user.role === 'super_admin'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Senaryo Yönetimi"
        description="Roleplay senaryolarını görüntüleyin ve yönetin"
        action={
          isSuperAdmin ? (
            <Button asChild>
              <Link href="/tenant/scenarios/new">
                <PlusIcon className="mr-2 h-4 w-4" />
                Yeni Senaryo
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ScenarioTable scenarios={scenarios} isSuperAdmin={isSuperAdmin} canToggle={isSuperAdmin || user.role === 'tenant_admin'} />
    </div>
  )
}
