import { PageHeader } from '@/components/admin/PageHeader'

export default function NewPersonaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Yeni Persona"
        description="Yeni bir AI koçluk personası oluşturun"
      />
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Persona form — Faz 5.5'te oluşturulacak</p>
      </div>
    </div>
  )
}
