'use client'

import { StarIcon, TrophyIcon, ClockIcon, SparklesIcon, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonaWithRecommendation } from '@/lib/queries/persona.queries'

const TAG_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  never_tried: { label: 'İlk kez dene',     icon: SparklesIcon, bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
  low_score:   { label: 'Gelişim fırsatı',  icon: TrophyIcon,   bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-600 dark:text-amber-400'  },
  stale:       { label: 'Tekrar dene',      icon: ClockIcon,    bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
  other:       { label: '',                 icon: StarIcon,     bg: '',                                    text: 'text-muted-foreground' },
}

const DIFFICULTY_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']

interface PersonaCardProps {
  persona: PersonaWithRecommendation
  onSelect: (id: string) => void
}

export function PersonaCard({ persona, onSelect }: PersonaCardProps) {
  const tag = TAG_CONFIG[persona.recommendation_tag]
  const TagIcon = tag.icon
  const displayName = persona.name

  const difficultyValue = persona.difficulty ?? persona.resistance_level ?? 0

  return (
    <button
      onClick={() => onSelect(persona.id)}
      className="group w-full overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex h-24">

        {/* Kolon 1: Avatar */}
        <div className="w-20 shrink-0">
          {persona.avatar_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={persona.avatar_image_url}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
              {displayName?.[0]
                ? <span className="text-2xl font-bold uppercase">{displayName[0]}</span>
                : <UserCircle className="h-8 w-8" />
              }
            </div>
          )}
        </div>

        {/* Kolon 2: Kimlik + istatistikler */}
        <div className="flex flex-1 flex-col justify-between border-x border-border/20 px-3 py-2 min-w-0">
          <div className="space-y-0.5 min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{displayName}</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">
              {persona.title}
            </p>
          </div>

          {/* Tag */}
          {persona.recommendation_tag !== 'other' && (
            <div className={cn('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', tag.bg, tag.text)}>
              <TagIcon className="h-2.5 w-2.5 shrink-0" />
              <span>{tag.label}</span>
            </div>
          )}

          {/* Alt istatistikler */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{persona.completed_sessions} seans</span>
            {persona.avg_score !== null ? (
              <span className="flex items-center gap-0.5">
                <StarIcon className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                {persona.avg_score.toFixed(1)}
              </span>
            ) : (
              <span className="italic">Hiç denenmedi</span>
            )}
          </div>
        </div>

        {/* Kolon 3: Zorluk + KPI + Tecrübe */}
        <div className="flex w-20 shrink-0 flex-col justify-between px-2.5 py-2">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Zorluk</p>
            <span className="flex flex-wrap gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    i < difficultyValue ? DIFFICULTY_COLORS[difficultyValue] : 'bg-muted'
                  )}
                />
              ))}
            </span>
          </div>

          <div className="space-y-0.5">
            {persona.experience_years ? (
              <p className="text-xs font-semibold">{persona.experience_years} <span className="text-[9px] font-normal text-muted-foreground">yıl</span></p>
            ) : null}
            <p className="text-[9px] text-muted-foreground">{persona.kpi_count} KPI</p>
          </div>
        </div>

      </div>
    </button>
  )
}
