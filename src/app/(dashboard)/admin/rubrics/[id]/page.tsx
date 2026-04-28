import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RubricDimensionCard } from '@/components/admin/RubricDimensionCard'
import { RubricTenantAssignment } from '@/components/admin/RubricTenantAssignment'
import { getRubricTemplateWithDimensions, getTenantsForRubricAssignment } from '@/lib/actions/rubric.actions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RubricDetailPage({ params }: Props) {
  const { id } = await params
  const [template, tenantData] = await Promise.all([
    getRubricTemplateWithDimensions(id),
    getTenantsForRubricAssignment(id),
  ])

  if (!template) notFound()

  const dimensions = (template.rubric_dimensions ?? []) as Parameters<typeof RubricDimensionCard>[0]['dimension'][]
  const activeDims = dimensions.filter((d) => d.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/admin/rubrics">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{template.name}</h1>
              {template.is_default && (
                <Badge variant="secondary" className="text-[10px]">Varsayılan</Badge>
              )}
              <Badge variant={template.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {template.is_active ? 'Aktif' : 'Pasif'}
              </Badge>
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{template.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {activeDims} aktif / {dimensions.length} toplam boyut
            </p>
          </div>
        </div>
      </div>

      <RubricTenantAssignment
        templateId={id}
        assigned={tenantData.assigned}
        unassigned={tenantData.unassigned}
      />

      {dimensions.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed py-16">
          <p className="text-muted-foreground text-sm">Bu template&apos;e henüz boyut eklenmemiş.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {dimensions.map((dim) => (
            <RubricDimensionCard key={dim.id} dimension={dim} />
          ))}
        </div>
      )}
    </div>
  )
}
