import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/PageHeader'
import { PersonaForm } from '@/components/admin/PersonaForm'
import { getPersonaWithPrompt } from '@/lib/actions/persona.actions'

interface EditPersonaPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPersonaPage({ params }: EditPersonaPageProps) {
  const { id } = await params
  const persona = await getPersonaWithPrompt(id)

  if (!persona) notFound()

  return (
    <div className="p-8 md:p-12 space-y-10 max-w-6xl mx-auto">
      <PageHeader
        title={`Persona Düzenle: ${persona.first_name || persona.name}`}
        description="Persona bilgilerini ve davranış parametrelerini güncelleyin"
      />
      
      <PersonaForm initialData={persona} />
    </div>
  )
}
