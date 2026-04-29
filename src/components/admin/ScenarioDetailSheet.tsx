'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Scenario } from '@/types'

type ScenarioWithPersona = Scenario & {
  personas?: { name: string; personality_type: string; avatar_image_url?: string | null } | null
}

interface ScenarioDetailSheetProps {
  scenario: ScenarioWithPersona | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DIFF_COLORS = ['', 'text-green-500', 'text-lime-500', 'text-yellow-500', 'text-orange-500', 'text-red-500']
const DIFF_LABELS = ['', 'Kolay', 'Orta-Alt', 'Orta', 'Zor', 'Çok Zor']

const PERSONALITY_LABELS: Record<string, string> = {
  dominant: 'Baskın', compliant: 'Uyumlu', resistant: 'Dirençli',
  analytical: 'Analitik', expressive: 'Duygusal', withdrawn: 'Çekingen',
}

export function ScenarioDetailSheet({ scenario, open, onOpenChange }: ScenarioDetailSheetProps) {
  if (!scenario) return null

  const level = scenario.difficulty_level ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{scenario.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Durum + Zorluk */}
          <div className="flex items-center gap-3">
            <StatusBadge active={scenario.is_active} />
            <span className={cn('font-semibold text-sm', DIFF_COLORS[level])}>
              {'●'.repeat(level)}{'○'.repeat(5 - level)}
            </span>
            <span className="text-xs text-muted-foreground">{DIFF_LABELS[level]}</span>
            <span className="text-xs text-muted-foreground ml-auto">{scenario.estimated_duration_min} dk</span>
          </div>

          {/* Açıklama */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Açıklama</p>
            <p className="text-sm leading-relaxed">{scenario.description}</p>
          </div>

          {/* Bağlam Kurulumu */}
          {scenario.context_setup && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bağlam Kurulumu</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{scenario.context_setup}</p>
            </div>
          )}

          {/* Rol Bağlamı */}
          {(scenario as any).role_context && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Yönetici Rolü</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{(scenario as any).role_context}</p>
            </div>
          )}

          {/* Hedef Beceriler */}
          {scenario.target_skills && scenario.target_skills.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Hedef Beceriler</p>
              <div className="flex flex-wrap gap-1.5">
                {scenario.target_skills.map((skill, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Persona */}
          {scenario.personas && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Persona</p>
              <div className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
                {scenario.personas.avatar_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={scenario.personas.avatar_image_url}
                    alt={scenario.personas.name}
                    className="h-10 w-10 rounded-full object-cover object-[center_15%] shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserCircle className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm">{scenario.personas.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {PERSONALITY_LABELS[scenario.personas.personality_type] ?? scenario.personas.personality_type}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
