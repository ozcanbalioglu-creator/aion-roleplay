'use client'

import { SparklesIcon, TrophyIcon, ClockIcon, StarIcon, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PersonaWithRecommendation } from '@/lib/queries/persona.queries'

const TAG_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  never_tried: { label: 'İlk kez dene',    icon: SparklesIcon, bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
  low_score:   { label: 'Gelişim fırsatı', icon: TrophyIcon,   bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-600 dark:text-amber-400'  },
  stale:       { label: 'Tekrar dene',     icon: ClockIcon,    bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
  other:       { label: '',                icon: StarIcon,     bg: '',                                    text: 'text-muted-foreground' },
}

const DIFFICULTY_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']

const GROWTH_TYPE_LABELS: Record<string, string> = {
  falling_performance:  'Düşen Performans',
  rising_performance:   'Yükselen Performans',
  resistant_experience: 'Dirençli Deneyim',
  new_to_role:          'Yeni Göreve Başlayan',
  motivation_crisis:    'Motivasyon Krizi',
}

interface PersonaCardProps {
  persona: PersonaWithRecommendation
  onSelect: (id: string) => void
}

export function PersonaCard({ persona, onSelect }: PersonaCardProps) {
  const tag = TAG_CONFIG[persona.recommendation_tag]
  const TagIcon = tag.icon
  const difficultyValue = persona.difficulty ?? persona.resistance_level ?? 0
  const growthLabel = GROWTH_TYPE_LABELS[(persona as any).growth_type] ?? null
  const description = (persona as any).scenario_description as string | undefined

  return (
    <button
      onClick={() => onSelect(persona.id)}
      className="group w-full rounded-xl border border-border/50 bg-card text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex gap-4 p-6">

        {/* Fotoğraf 80×80 */}
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-primary/10">
          {persona.avatar_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={persona.avatar_image_url}
              alt={persona.name}
              className="h-full w-full object-cover object-[center_15%]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary">
              {persona.name?.[0]
                ? <span className="text-2xl font-bold uppercase">{persona.name[0]}</span>
                : <UserCircle className="h-8 w-8" />
              }
            </div>
          )}
        </div>

        {/* İçerik */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xl font-bold leading-tight" style={{ color: '#8052a3' }}>{persona.name}</p>

          {persona.title && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{persona.title}</p>
          )}

          {growthLabel && (
            <p className="text-[10px] text-muted-foreground">{growthLabel}</p>
          )}

          {description && (
            <p className="mt-1 text-sm leading-snug text-muted-foreground line-clamp-2">{description}</p>
          )}

          <div className="mt-auto flex items-center gap-3 pt-2">
            {/* Zorluk noktaları */}
            <span className="flex gap-0.5">
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

            {persona.experience_years ? (
              <span className="text-xs text-muted-foreground">{persona.experience_years} yıl</span>
            ) : null}

            {/* Öneri etiketi */}
            {persona.recommendation_tag !== 'other' && (
              <div className={cn('ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', tag.bg, tag.text)}>
                <TagIcon className="h-2.5 w-2.5 shrink-0" />
                <span>{tag.label}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </button>
  )
}
