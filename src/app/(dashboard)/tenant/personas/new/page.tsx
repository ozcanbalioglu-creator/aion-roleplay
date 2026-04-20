import { PageHeader } from '@/components/admin/PageHeader'
import { PersonaForm } from '@/components/admin/PersonaForm'

export const dynamic = 'force-dynamic'

export default function NewPersonaPage() {
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
