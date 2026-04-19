import { PageHeader } from '@/components/admin/PageHeader'

export default async function PromptsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompt Yönetimi"
        description="AI sistem prompt'larını düzenleyin ve versiyon geçmişini inceleyin"
      />
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Prompt template listesi — Faz 5.6'da oluşturulacak</p>
      </div>
    </div>
  )
}
