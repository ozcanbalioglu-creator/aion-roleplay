import { PageHeader } from '@/components/admin/PageHeader'
import { RubricDimensionCard } from '@/components/admin/RubricDimensionCard'
import { getRubricTemplatesWithDimensions } from '@/lib/actions/rubric.actions'

export const dynamic = 'force-dynamic'

export default async function RubricsPage() {
  const templates = await getRubricTemplatesWithDimensions()

  const allDimensions = templates.flatMap(
    (t: { rubric_dimensions: unknown[] }) => t.rubric_dimensions
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rubric Yapılandırması"
        description="Koçluk becerilerinin değerlendirilmesi ölçütlerini yönetin"
      />
      {allDimensions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <p className="text-muted-foreground">Henüz rubric boyutu tanımlanmamış.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {allDimensions.map((dim) => (
            <RubricDimensionCard key={(dim as { id: string }).id} dimension={dim as Parameters<typeof RubricDimensionCard>[0]['dimension']} />
          ))}
        </div>
      )}
    </div>
  )
}
