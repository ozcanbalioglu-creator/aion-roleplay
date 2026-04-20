'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRightIcon } from 'lucide-react'

interface PromptVersion {
  id: string
  version_number: number
  is_active: boolean
  created_at: string
  content: string
  variables?: string[]
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

interface PromptTemplateListProps {
  templates: PromptTemplate[]
  onSelect: (template: PromptTemplate) => void
  selectedId?: string
}

const TYPE_LABELS: Record<string, string> = {
  role_play_system: 'Roleplay Sistemi',
  session_summary: 'Seans Özeti',
  evaluation_extraction: 'Değerlendirme Çıkarımı',
  evaluation_scoring: 'Puanlama',
  feedback_coaching: 'Geri Bildirim Koçluğu',
  manager_insights: 'Yönetici Raporları',
}

export function PromptTemplateList({ templates, onSelect, selectedId }: PromptTemplateListProps) {
  return (
    <div className="space-y-2">
      {templates.map((template) => {
        const activeVersion = template.prompt_versions.find((v) => v.is_active)
        const isSelected = template.id === selectedId

        return (
          <Card
            key={template.id}
            className={`cursor-pointer transition-colors hover:bg-accent ${isSelected ? 'border-primary bg-accent' : ''}`}
            onClick={() => onSelect(template)}
          >
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[template.type] ?? template.type}
                </Badge>
                {activeVersion && (
                  <span className="text-xs text-muted-foreground">
                    v{activeVersion.version_number} aktif
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
