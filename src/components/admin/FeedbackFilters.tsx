'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface Option { id: string; name?: string; title?: string }

interface FeedbackFiltersProps {
  tenants: Option[]
  personas: Option[]
  scenarios: Option[]
  currentTenantId?: string
  currentPersonaId?: string
  currentScenarioId?: string
}

export function FeedbackFilters({
  tenants,
  personas,
  scenarios,
  currentTenantId,
  currentPersonaId,
  currentScenarioId,
}: FeedbackFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  const hasFilters = !!(currentTenantId || currentPersonaId || currentScenarioId)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={currentTenantId ?? 'all'}
        onValueChange={(v) => update('tenantId', v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Tüm Tenantlar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Tenantlar</SelectItem>
          {tenants.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentPersonaId ?? 'all'}
        onValueChange={(v) => update('personaId', v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Tüm Personalar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Personalar</SelectItem>
          {personas.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentScenarioId ?? 'all'}
        onValueChange={(v) => update('scenarioId', v)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Tüm Senaryolar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Senaryolar</SelectItem>
          {scenarios.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs"
          onClick={() => router.push('?')}
        >
          Filtreleri Temizle
        </Button>
      )}
    </div>
  )
}
