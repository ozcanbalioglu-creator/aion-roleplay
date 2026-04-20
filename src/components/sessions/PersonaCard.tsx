'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StarIcon, TrophyIcon, ClockIcon, SparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonaWithRecommendation } from '@/lib/queries/persona.queries'

const PERSONALITY_LABELS: Record<string, { label: string; color: string }> = {
  analytical:  { label: 'Analitik',     color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  driver:      { label: 'Sonuç Odaklı', color: 'bg-red-500/10 text-red-700 border-red-500/20' },
  expressive:  { label: 'Duygusal',     color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  amiable:     { label: 'Uyumlu',       color: 'bg-green-500/10 text-green-700 border-green-500/20' },
  resistant:   { label: 'Dirençli',     color: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
  indifferent: { label: 'İlgisiz',      color: 'bg-gray-500/10 text-gray-700 border-gray-500/20' },
}

const TAG_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  never_tried: { label: 'İlk kez dene',     icon: SparklesIcon, color: 'text-indigo-600' },
  low_score:   { label: 'Gelişim fırsatı',  icon: TrophyIcon,   color: 'text-amber-600' },
  stale:       { label: 'Uzun süredir yok', icon: ClockIcon,    color: 'text-orange-600' },
  other:       { label: '',                 icon: StarIcon,     color: 'text-gray-400' },
}

interface PersonaCardProps {
  persona: PersonaWithRecommendation
  onSelect: (id: string) => void
}

export function PersonaCard({ persona, onSelect }: PersonaCardProps) {
  const personality = PERSONALITY_LABELS[persona.personality_type]
  const tag = TAG_CONFIG[persona.recommendation_tag]
  const TagIcon = tag.icon

  return (
    <Card
      className="cursor-pointer border transition-all hover:border-primary/50 hover:shadow-md"
      onClick={() => onSelect(persona.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="font-semibold leading-tight">{persona.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{persona.title}</p>
            {persona.department && (
              <p className="text-xs text-muted-foreground opacity-75">{persona.department}</p>
            )}
          </div>
          {persona.recommendation_tag !== 'other' && (
            <div className={cn('flex items-center gap-1 text-xs font-medium', tag.color)}>
              <TagIcon className="h-3.5 w-3.5" />
              <span>{tag.label}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Kişilik Badge */}
        <Badge
          variant="outline"
          className={cn('text-xs', personality?.color)}
        >
          {personality?.label ?? persona.personality_type}
        </Badge>

        {/* Direnç ve İşbirliği */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Direnç</p>
            <ResistanceBar level={persona.resistance_level} color="red" />
          </div>
          <div>
            <p className="text-muted-foreground">İşbirliği</p>
            <ResistanceBar level={persona.cooperativeness_level} color="green" />
          </div>
        </div>

        {/* İstatistik */}
        <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
          <span>{persona.completed_sessions} seans</span>
          {persona.avg_score !== null ? (
            <span className="flex items-center gap-0.5">
              <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
              {persona.avg_score.toFixed(1)}
            </span>
          ) : (
            <span className="italic">Hiç denenmedi</span>
          )}
          <span>{persona.kpi_count} KPI</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ResistanceBar({ level, color }: { level: number; color: 'red' | 'green' }) {
  return (
    <div className="mt-1 flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            i < level
              ? color === 'red'
                ? 'bg-red-400'
                : 'bg-green-400'
              : 'bg-muted'
          )}
        />
      ))}
    </div>
  )
}
