import Link from 'next/link'
import { PageHeader } from '@/components/admin/PageHeader'
import { ScenarioTable } from './ScenarioTable'
import { getScenarios } from '@/lib/actions/scenario.actions'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ScenariosPage() {
  const scenarios = await getScenarios()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Senaryo Yönetimi"
        description="Roleplay senaryolarını oluşturun ve yönetin"
        action={
          <Button asChild>
            <Link href="/tenant/scenarios/new">
              <PlusIcon className="mr-2 h-4 w-4" />
              Yeni Senaryo
            </Link>
          </Button>
        }
      />
      <ScenarioTable scenarios={scenarios} />
    </div>
  )
}
