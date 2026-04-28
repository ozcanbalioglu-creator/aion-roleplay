'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { UserCircle } from 'lucide-react'
import type { Persona } from '@/types'
import { cn } from '@/lib/utils'

const DIFFICULTY_COLORS = ['', 'text-green-500', 'text-lime-500', 'text-yellow-500', 'text-orange-500', 'text-red-500']
const DIFFICULTY_LABELS = ['', 'Kolay', 'Orta-Alt', 'Orta', 'Zor', 'Çok Zor']

const RESISTANCE_COLORS = ['', 'text-green-500', 'text-lime-500', 'text-yellow-500', 'text-orange-500', 'text-red-500']
const RESISTANCE_LABELS = ['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek']

const COOPERATIVENESS_COLORS = ['', 'text-red-500', 'text-orange-500', 'text-yellow-500', 'text-lime-500', 'text-green-500']
const COOPERATIVENESS_LABELS = ['', 'Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek']

const GROWTH_TYPE_LABELS: Record<string, string> = {
  falling_performance: 'Düşen Performans',
  rising_performance: 'Yükselen Performans',
  resistant_experience: 'Dirençli Deneyim',
  new_to_role: 'Yeni Göreve Başlayan',
  motivation_crisis: 'Motivasyon Krizi',
}

const EMOTIONAL_LABELS: Record<string, string> = {
  motivated: 'Motive',
  demotivated: 'Motivasyonsuz',
  frustrated: 'Hüsranlı',
  neutral: 'Nötr',
  anxious: 'Endişeli',
  confident: 'Kendinden Emin',
  burned_out: 'Tükenmişlik',
}

interface PersonaDetailSheetProps {
  persona: Persona | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PersonaDetailSheet({ persona, open, onOpenChange }: PersonaDetailSheetProps) {
  if (!persona) return null

  const displayName = persona.name

  const level = persona.difficulty ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Persona Detayı</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">

          {/* Kimlik */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border/40">
              {persona.avatar_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={persona.avatar_image_url}
                  alt={displayName}
                  className="h-full w-full object-cover object-[center_15%]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                  <UserCircle className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-lg font-semibold leading-tight">{displayName}</p>
              <p className="text-sm text-muted-foreground">{persona.title}</p>
              {persona.department && (
                <p className="text-xs text-muted-foreground">{persona.department}</p>
              )}
              {persona.location && (
                <p className="text-xs text-muted-foreground">{persona.location}</p>
              )}
            </div>
          </div>

          {/* Metrikler */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Zorluk</p>
              <span className={cn('font-bold text-sm', DIFFICULTY_COLORS[level])}>
                {'●'.repeat(level)}{'○'.repeat(5 - level)}
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">{DIFFICULTY_LABELS[level]}</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Direnç</p>
              {persona.resistance_level != null ? (
                <>
                  <span className={cn('font-bold text-sm', RESISTANCE_COLORS[persona.resistance_level])}>
                    {'●'.repeat(persona.resistance_level)}{'○'.repeat(5 - persona.resistance_level)}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{RESISTANCE_LABELS[persona.resistance_level]}</p>
                </>
              ) : (
                <p className="text-sm font-bold">—</p>
              )}
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">İşbirliği</p>
              {persona.cooperativeness != null ? (
                <>
                  <span className={cn('font-bold text-sm', COOPERATIVENESS_COLORS[persona.cooperativeness])}>
                    {'●'.repeat(persona.cooperativeness)}{'○'.repeat(5 - persona.cooperativeness)}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{COOPERATIVENESS_LABELS[persona.cooperativeness]}</p>
                </>
              ) : (
                <p className="text-sm font-bold">—</p>
              )}
            </div>
          </div>

          {persona.experience_years != null && (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Deneyim</p>
              <p className="text-base font-semibold">{persona.experience_years} yıl</p>
            </div>
          )}

          {/* Kişilik Profili */}
          <div className="space-y-3">
            {(persona as any).growth_type && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Persona Tipi</p>
                <p className="text-sm">{GROWTH_TYPE_LABELS[(persona as any).growth_type] ?? (persona as any).growth_type}</p>
              </div>
            )}
            {persona.emotional_baseline && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Duygusal Baz</p>
                <p className="text-sm">{EMOTIONAL_LABELS[persona.emotional_baseline] ?? persona.emotional_baseline}</p>
              </div>
            )}
          </div>

          {/* Senaryo Bağlamı */}
          {persona.scenario_description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Senaryo Bağlamı</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{persona.scenario_description}</p>
            </div>
          )}

          {/* Koçluk Bağlamı */}
          {persona.coaching_context && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Koçluk Bağlamı</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{persona.coaching_context}</p>
            </div>
          )}

          {/* Koçluk İpuçları */}
          {persona.coaching_tips && (Array.isArray(persona.coaching_tips) ? persona.coaching_tips.length > 0 : true) && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Koçluk İpuçları</p>
              {Array.isArray(persona.coaching_tips) ? (
                <ul className="space-y-1.5">
                  {(persona.coaching_tips as string[]).map((tip, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-sidebar-primary mt-0.5 shrink-0">•</span>
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
                  <Badge key={i} className="text-xs bg-violet-100 text-violet-700 border-0 hover:bg-violet-100">{t}</Badge>
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
      </SheetContent>
    </Sheet>
  )
}
