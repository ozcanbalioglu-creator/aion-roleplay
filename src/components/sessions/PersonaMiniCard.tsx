'use client'

import { UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Persona } from '../../types/index'

const DIFFICULTY_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']

const GROWTH_TYPE_LABELS: Record<string, string> = {
  falling_performance:  'Düşen Performans',
  rising_performance:   'Yükselen Performans',
  resistant_experience: 'Dirençli Deneyim',
  new_to_role:          'Yeni Göreve Başlayan',
  motivation_crisis:    'Motivasyon Krizi',
}

export function PersonaMiniCard({ persona }: { persona: Persona }) {
  const difficultyValue = persona.difficulty ?? 0
  const growthLabel = GROWTH_TYPE_LABELS[(persona as any).growth_type] ?? null
  const description = persona.scenario_description

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">

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
          </div>
        </div>

      </div>

      {/* Ek bilgiler: KPI + Tetikleyiciler */}
      {((persona.persona_kpis?.length ?? 0) > 0 || (persona.trigger_behaviors?.length ?? 0) > 0) && (
        <div className="border-t border-border/20 px-6 py-4 space-y-3">
          {(persona.persona_kpis?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">KPI Profili</p>
              <div className="space-y-1">
                {(persona.persona_kpis ?? []).slice(0, 4).map((kpi: any) => (
                  <div key={kpi.kpi_code} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{kpi.kpi_name}</span>
                    <span className="font-medium">{kpi.value}{kpi.unit ? ` ${kpi.unit}` : ''}</span>
                  </div>
                ))}
                {(persona.persona_kpis?.length ?? 0) > 4 && (
                  <p className="text-xs text-muted-foreground">+{(persona.persona_kpis?.length ?? 0) - 4} daha...</p>
                )}
              </div>
            </div>
          )}
          {(persona.trigger_behaviors?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Tetikleyiciler</p>
              <ul className="space-y-0.5">
                {(persona.trigger_behaviors as string[]).slice(0, 3).map((t, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
