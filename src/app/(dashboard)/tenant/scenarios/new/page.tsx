import { PageHeader } from '@/components/admin/PageHeader'
import { ScenarioForm } from '@/components/admin/ScenarioForm'
import { getPersonas } from '@/lib/actions/persona.actions'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function NewScenarioPage() {
  const [user, personas] = await Promise.all([
    getCurrentUser(),
    getPersonas()
  ])

  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni Senaryo"
        description="Yeni bir roleplay senaryosu oluşturun"
      />
      <ScenarioForm personas={personas} />
    </div>
  )
}
