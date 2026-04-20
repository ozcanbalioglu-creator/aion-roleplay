'use client'

import { useState } from 'react'
import { PromptTemplateList } from '@/components/admin/PromptTemplateList'
import { PromptEditor } from '@/components/admin/PromptEditor'

interface PromptVersion {
  id: string
  version_number: number
  content: string
  is_active: boolean
  created_at: string
  variables: string[]
  [key: string]: unknown
}

interface PromptTemplate {
  id: string
  name: string
  type: string
  description?: string
  prompt_versions: PromptVersion[]
  [key: string]: unknown
}

interface PromptManagementClientProps {
  templates: PromptTemplate[]
}

export function PromptManagementClient({ templates }: PromptManagementClientProps) {
  const [selected, setSelected] = useState<PromptTemplate | null>(
    templates.length > 0 ? templates[0] : null
  )

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <p className="text-muted-foreground">Henüz prompt template yok.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      <div className="w-64 shrink-0">
        <PromptTemplateList
          templates={templates}
          onSelect={(t) => setSelected(t as unknown as PromptTemplate)}
          selectedId={selected?.id}
        />
      </div>
      <div className="flex-1">
        {selected ? (
          <PromptEditor
            templateId={selected.id}
            templateName={selected.name}
            versions={selected.prompt_versions ?? []}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">Sol taraftan bir template seçin</p>
          </div>
        )}
      </div>
    </div>
  )
}
