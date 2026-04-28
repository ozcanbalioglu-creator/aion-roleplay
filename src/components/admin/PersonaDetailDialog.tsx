'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { UserCircle } from 'lucide-react'
import type { Persona } from '@/types'
import { cn } from '@/lib/utils'

const DIFFICULTY_COLORS = ['', 'text-green-500', 'text-lime-500', 'text-yellow-500', 'text-orange-500', 'text-red-500']
const DIFFICULTY_LABELS = ['', 'Kolay', 'Orta-Alt', 'Orta', 'Zor', 'Çok Zor']

interface PersonaDetailDialogProps {
  persona: Persona | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PersonaDetailDialog({ persona, open, onOpenChange }: PersonaDetailDialogProps) {
  if (!persona) return null

  const displayName = persona.name

  const level = persona.difficulty ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Persona Detayı</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Kimlik */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full">
              {persona.avatar_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={persona.avatar_image_url}
                  alt={displayName}
                  className="h-full w-full object-cover object-[center_15%]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                  <UserCircle className="h-8 w-8" />
                </div>
              )}
            </div>
            <div>
              <p className="text-lg font-semibold">{displayName}</p>
              <p className="text-sm text-muted-foreground">{persona.title}</p>
              {persona.department && (
                <p className="text-xs text-muted-foreground">{persona.department}</p>
              )}
            </div>
          </div>

          {/* Zorluk & Deneyim */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Zorluk</p>
              <span className={cn('font-semibold', DIFFICULTY_COLORS[level])}>
                {'●'.repeat(level)}{'○'.repeat(5 - level)}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">{DIFFICULTY_LABELS[level]}</p>
            </div>
            {persona.experience_years != null && (
              <div className="rounded-lg border border-border/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Deneyim</p>
                <p className="text-lg font-semibold">{persona.experience_years} yıl</p>
              </div>
            )}
          </div>

          {/* Kişilik & Duygusal Baz */}
          <div className="space-y-2">
            {persona.personality_type && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kişilik Tipi</p>
                <p className="text-sm mt-0.5">{persona.personality_type}</p>
              </div>
            )}
            {persona.emotional_baseline && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Duygusal Baz</p>
                <p className="text-sm mt-0.5">{persona.emotional_baseline}</p>
              </div>
            )}
          </div>

          {/* Senaryo Açıklaması */}
          {persona.scenario_description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Senaryo Bağlamı</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{persona.scenario_description}</p>
            </div>
          )}

          {/* Koçluk İpuçları */}
          {persona.coaching_tips && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Koçluk İpuçları</p>
              {Array.isArray(persona.coaching_tips) ? (
                <ul className="space-y-1">
                  {(persona.coaching_tips as string[]).map((tip, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{persona.coaching_tips as string}</p>
              )}
            </div>
          )}

          {/* Tetikleyici Davranışlar */}
          {persona.trigger_behaviors && persona.trigger_behaviors.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tetikleyici Davranışlar</p>
              <div className="flex flex-wrap gap-1.5">
                {persona.trigger_behaviors.map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* KPI'lar */}
          {persona.persona_kpis && persona.persona_kpis.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">KPI&apos;lar</p>
              <div className="grid grid-cols-2 gap-2">
                {persona.persona_kpis.map((kpi, i) => (
                  <div key={i} className="rounded-lg border border-border/30 bg-muted/30 p-2.5">
                    <p className="text-[10px] text-muted-foreground truncate">{kpi.kpi_name}</p>
                    <p className="text-sm font-semibold">
                      {kpi.value}{kpi.unit ? ` ${kpi.unit}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
