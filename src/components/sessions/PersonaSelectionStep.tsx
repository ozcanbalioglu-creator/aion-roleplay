'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { PersonaCard } from '@/components/sessions/PersonaCard'
import type { PersonaWithRecommendation } from '@/lib/queries/persona.queries'

interface PersonaSelectionStepProps {
  personas: PersonaWithRecommendation[]
}

const FILTERS = [
  { key: 'all',        label: 'Tümü' },
  { key: 'never_tried', label: 'İlk Kez' },
  { key: 'low_score',   label: 'Gelişim' },
  { key: 'stale',       label: 'Tekrar Dene' },
] as const

export function PersonaSelectionStep({ personas }: PersonaSelectionStepProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState<string>('all')

  const filtered = personas.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.title ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesTag = filterTag === 'all' || p.recommendation_tag === filterTag
    return matchesSearch && matchesTag
  })

  const counts: Record<string, number> = {
    all: personas.length,
    never_tried: personas.filter((p) => p.recommendation_tag === 'never_tried').length,
    low_score:   personas.filter((p) => p.recommendation_tag === 'low_score').length,
    stale:       personas.filter((p) => p.recommendation_tag === 'stale').length,
  }

  const handleSelect = (personaId: string) => {
    router.push(`/dashboard/sessions/new?persona=${personaId}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Persona Seçin</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Koçluk yapacağınız personayı seçin. Önerilen sıralama gelişim fırsatlarınıza göre düzenlendi.
        </p>
      </div>

      {/* Arama + Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="İsim veya unvan ara..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const isActive = filterTag === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilterTag(f.key)}
                className={
                  isActive
                    ? 'rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary'
                    : 'rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors'
                }
              >
                {f.label}
                <span className={isActive ? 'ml-1.5 text-primary/70' : 'ml-1.5 text-muted-foreground/70'}>
                  {counts[f.key] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Persona Grid — 1 / 2 / 3 kolon */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Arama kriteriyle eşleşen persona bulunamadı.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </div>
  )
}
