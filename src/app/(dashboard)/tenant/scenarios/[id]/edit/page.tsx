import { PageHeader } from '@/components/admin/PageHeader'
import { ScenarioForm } from '@/components/admin/ScenarioForm'
import { getScenarioById } from '@/lib/actions/scenario.actions'
import { getPersonas } from '@/lib/actions/persona.actions'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface EditScenarioPageProps {
  params: Promise<{ id: string }>
}

export default async function EditScenarioPage({ params }: EditScenarioPageProps) {
  const { id } = await params
  const [user, scenario, personas] = await Promise.all([
    getCurrentUser(),
    getScenarioById(id),
    getPersonas(),
  ])

  if (!user || user.role !== 'super_admin') redirect('/dashboard')
  if (!scenario) notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Senaryoyu Düzenle"
        description={`"${scenario.title}" senaryosunu güncelle`}
      />
      <ScenarioForm personas={personas} initialScenario={scenario as any} isEdit />
    </div>
  )
}
