import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/admin/PageHeader'
import { PersonaForm } from '@/components/admin/PersonaForm'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function NewPersonaPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') redirect('/tenant/personas')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni Persona"
        description="Roleplay için yeni bir karakter oluşturun"
      />
      <PersonaForm />
    </div>
  )
}
