'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { PersonaCard } from '@/components/sessions/PersonaCard'
import type { PersonaWithRecommendation } from '@/lib/queries/persona.queries'

interface PersonaSelectionStepProps {
  personas: PersonaWithRecommendation[]
}

export function PersonaSelectionStep({ personas }: PersonaSelectionStepProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState<string>('all')

  const filtered = personas.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase())
    const matchesTag = filterTag === 'all' || p.recommendation_tag === filterTag
    return matchesSearch && matchesTag
  })

  const tagCounts = {
    never_tried: personas.filter((p) => p.recommendation_tag === 'never_tried').length,
    low_score: personas.filter((p) => p.recommendation_tag === 'low_score').length,
    stale: personas.filter((p) => p.recommendation_tag === 'stale').length,
    other: personas.filter((p) => p.recommendation_tag === 'other').length,
  }

  const handleSelect = (personaId: string) => {
    router.push(`/dashboard/sessions/new?persona=${personaId}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Persona Seçin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Koçluk yapacağınız personayı seçin. Önerilen sıralama gelişim fırsatlarınıza göre düzenlendi.
        </p>
      </div>

      {/* Filtre ve Arama */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="İsim veya unvan ara..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'never_tried', label: `İlk Kez (${tagCounts.never_tried})` },
            { key: 'low_score', label: `Gelişim (${tagCounts.low_score})` },
            { key: 'stale', label: `Tekrar Dene (${tagCounts.stale})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterTag(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterTag === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Persona Grid */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Arama kriteriyle eşleşen persona bulunamadı.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </div>
  )
}