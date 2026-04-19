import { PageHeader } from '@/components/admin/PageHeader'

export default async function RubricsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rubric Yapılandırması"
        description="Koçluk becerilerinin değerlendirilmesi ölçütlerini yönetin"
      />
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Rubric dimensions konfigürasyonu — Faz 5.7'de oluşturulacak</p>
      </div>
    </div>
  )
}
