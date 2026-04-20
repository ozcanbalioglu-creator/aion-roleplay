import { PageHeader } from '@/components/admin/PageHeader'
import { PromptManagementClient } from './PromptManagementClient'
import { getPromptTemplates } from '@/lib/actions/prompt.actions'

export const dynamic = 'force-dynamic'

export default async function PromptsPage() {
  const templates = await getPromptTemplates()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompt Yönetimi"
        description="Sistem promptlarını düzenleyin ve versiyon geçmişini görüntüleyin"
      />
      <PromptManagementClient templates={templates} />
    </div>
  )
}
