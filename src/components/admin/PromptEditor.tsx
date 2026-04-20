'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useServerAction } from '@/hooks/useServerAction'
import { updatePromptVersionAction, rollbackPromptVersionAction } from '@/lib/actions/prompt.actions'
import { HistoryIcon, SaveIcon, RotateCcwIcon } from 'lucide-react'

interface PromptVersion {
  id: string
  version_number: number
  content: string
  is_active: boolean
  created_at: string
  variables: string[]
}

interface PromptEditorProps {
  templateId: string
  templateName: string
  versions: PromptVersion[]
}

export function PromptEditor({ templateId, templateName, versions }: PromptEditorProps) {
  const activeVersion = versions.find((v) => v.is_active)
  const [content, setContent] = useState(activeVersion?.content ?? '')
  const [showHistory, setShowHistory] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState<PromptVersion | null>(null)

  const { execute: executeSave, isPending: isSaving } = useServerAction(
    (fd: FormData) => updatePromptVersionAction(templateId, fd)
  )

  const { execute: executeRollback, isPending: isRollingBack } = useServerAction(
    (versionId: string) => rollbackPromptVersionAction(versionId, templateId),
    { onSuccess: () => setRollbackTarget(null) }
  )

  function handleSave() {
    const fd = new FormData()
    fd.set('content', content)
    fd.set('variables', JSON.stringify(extractVariables(content)))
    executeSave(fd)
  }

  function extractVariables(text: string) {
    const matches = text.match(/\{([^}]+)\}/g) ?? []
    return [...new Set(matches.map((m) => m.slice(1, -1)))]
  }

  const variables = extractVariables(content)
  const isDirty = content !== (activeVersion?.content ?? '')

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{templateName}</h3>
          {activeVersion && (
            <p className="text-sm text-muted-foreground">
              Aktif: v{activeVersion.version_number} —{' '}
              {new Date(activeVersion.created_at).toLocaleDateString('tr-TR')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <HistoryIcon className="mr-1.5 h-4 w-4" />
            Geçmiş ({versions.length})
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            <SaveIcon className="mr-1.5 h-4 w-4" />
            {isSaving ? 'Kaydediliyor...' : 'Yeni Versiyon Kaydet'}
          </Button>
        </div>
      </div>

      {variables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {variables.map((v) => (
            <Badge key={v} variant="secondary" className="font-mono text-xs">
              {'{'}
              {v}
              {'}'}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-1 gap-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 font-mono text-sm"
          rows={20}
          placeholder="Prompt içeriğini buraya girin..."
        />

        {showHistory && (
          <div className="w-64 shrink-0">
            <p className="mb-2 text-sm font-medium">Versiyon Geçmişi</p>
            <ScrollArea className="h-96">
              <div className="space-y-2 pr-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`rounded-md border p-2.5 text-sm ${version.is_active ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">v{version.version_number}</span>
                      {version.is_active && (
                        <Badge variant="default" className="text-xs">Aktif</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleDateString('tr-TR')}
                    </p>
                    {!version.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 w-full text-xs"
                        onClick={() => setRollbackTarget(version)}
                        disabled={isRollingBack}
                      >
                        <RotateCcwIcon className="mr-1 h-3 w-3" />
                        Geri Al
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
        title="Versiyona Geri Dön"
        description={`v${rollbackTarget?.version_number} versiyonunu aktif yapmak istediğinize emin misiniz? Mevcut aktif versiyon pasifleştirilecek.`}
        confirmLabel="Geri Al"
        onConfirm={() => rollbackTarget && executeRollback(rollbackTarget.id)}
      />
    </div>
  )
}
