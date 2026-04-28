'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useServerAction } from '@/hooks/useServerAction'
import { updateRubricDimensionAction, toggleDimensionActiveAction } from '@/lib/actions/rubric.actions'
import { PencilIcon, CheckIcon, XIcon } from 'lucide-react'

interface ScoreLabels {
  1: string
  2: string
  3: string
  4: string
  5: string
}

interface RubricDimension {
  id: string
  dimension_code: string
  name: string
  description?: string
  is_active: boolean
  weight: number
  score_labels: ScoreLabels
}

interface RubricDimensionCardProps {
  dimension: RubricDimension
}

export function RubricDimensionCard({ dimension }: RubricDimensionCardProps) {
  const [isEditing, setIsEditing] = useState(false)

  const { execute: executeSave, isPending: isSaving } = useServerAction(
    (fd: FormData) => updateRubricDimensionAction(dimension.id, fd),
    { onSuccess: () => setIsEditing(false) }
  )

  const { execute: executeToggle, isPending: isToggling } = useServerAction(
    () => toggleDimensionActiveAction(dimension.id, dimension.is_active)
  )

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    executeSave(fd)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm">{dimension.name}</CardTitle>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{dimension.dimension_code}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge active={dimension.is_active} />
            <Switch
              checked={dimension.is_active}
              onCheckedChange={() => executeToggle()}
              disabled={isToggling}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setIsEditing(!isEditing)}
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor={`name-${dimension.id}`} className="text-xs">Ad</Label>
              <Input
                id={`name-${dimension.id}`}
                name="name"
                defaultValue={dimension.name}
                className="h-8 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-1">
              <p className="text-xs font-medium text-muted-foreground">Puan Etiketleri (1–5)</p>
              {([1, 2, 3, 4, 5] as const).map((score) => (
                <div key={score} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-xs font-medium">{score}</span>
                  <Input
                    name={`score_${score}_label`}
                    defaultValue={dimension.score_labels[score]}
                    className="h-7 text-xs"
                    required
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label htmlFor={`weight-${dimension.id}`} className="text-xs">
                Ağırlık (0–1)
              </Label>
              <Input
                id={`weight-${dimension.id}`}
                name="weight"
                type="number"
                step="0.1"
                min="0"
                max="1"
                defaultValue={dimension.weight}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isSaving}>
                <CheckIcon className="mr-1 h-3.5 w-3.5" />
                Kaydet
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                <XIcon className="mr-1 h-3.5 w-3.5" />
                İptal
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            {dimension.description && (
              <p className="text-xs text-muted-foreground">{dimension.description}</p>
            )}
            <div className="grid grid-cols-5 gap-1">
              {([1, 2, 3, 4, 5] as const).map((score) => (
                <div key={score} className="rounded bg-muted px-1.5 py-1 text-center">
                  <p className="text-xs font-semibold">{score}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {dimension.score_labels[score]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
