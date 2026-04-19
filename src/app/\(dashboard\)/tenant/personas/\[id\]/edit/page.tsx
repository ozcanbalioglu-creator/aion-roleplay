import { PageHeader } from '@/components/admin/PageHeader'

export default async function EditPersonaPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Persona Düzenle"
        description={`ID: ${params.id}`}
      />
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Persona edit form — Faz 5.5'te oluşturulacak</p>
      </div>
    </div>
  )
}
