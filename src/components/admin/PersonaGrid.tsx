'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useServerAction } from '@/hooks/useServerAction'
import { togglePersonaStatusAction } from '@/lib/actions/persona.actions'
import { PencilIcon } from 'lucide-react'
import type { Persona } from '@/types'
import { cn } from '@/lib/utils'

const GROWTH_LABELS: Record<string, string> = {
  falling_performance: 'Düşen Performans',
  rising_performance: 'Yükselen Performans',
  resistant_experience: 'Dirençli Deneyim',
  new_starter: 'Yeni Göreve Başlayan',
  motivation_crisis: 'Motivasyon Krizi',
}

const DIFFICULTY_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']

interface PersonaGridProps {
  personas: Persona[]
}

export function PersonaGrid({ personas }: PersonaGridProps) {
  const [confirmTarget, setConfirmTarget] = useState<Persona | null>(null)
  const { execute, isPending } = useServerAction(togglePersonaStatusAction)

  if (personas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/20 py-16 bg-card/40">
        <p className="text-muted-foreground text-sm font-medium">Henüz persona oluşturulmadı.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((persona) => (
          <Card key={persona.id} className="flex flex-col bg-card/60 backdrop-blur-sm border-border/40 hover:border-primary/40 transition-all group shadow-sm hover:shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold tracking-tight">
                    {persona.first_name ? `${persona.first_name} ${persona.last_name || ''}` : persona.name}
                  </CardTitle>
                  <p className="text-xs font-medium text-on-primary-container/70 uppercase tracking-widest">{persona.title}</p>
                </div>
                <StatusBadge active={persona.is_active} />
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 pb-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-on-primary-container/10 text-on-primary-container border-none text-[10px] uppercase font-bold tracking-tighter px-2 py-0.5">
                  {GROWTH_LABELS[persona.growth_type] ?? persona.growth_type}
                </Badge>
                {persona.experience_years && (
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">
                    {persona.experience_years} Yıl Tecrübe
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Zorluk:</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full ${i < (persona.difficulty ?? 0) ? DIFFICULTY_COLORS[persona.difficulty ?? 0] : 'bg-muted'}`}
                    />
                  ))}
                </span>
              </div>
            </CardContent>
            <CardFooter className="gap-3 pt-4 border-t border-border/20">
              <Button asChild size="sm" variant="outline" className="flex-1 rounded-full text-[10px] uppercase font-bold tracking-widest h-9 border-border/40 hover:bg-surface-container-highest">
                <Link href={`/tenant/personas/${persona.id}/edit`}>
                  <PencilIcon className="mr-2 h-3.5 w-3.5" />
                  Düzenle
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmTarget(persona)}
                disabled={isPending}
                className={cn(
                  "flex-1 rounded-full text-[10px] uppercase font-bold tracking-widest h-9",
                  persona.is_active ? "text-error hover:text-error hover:bg-error/10" : "text-primary hover:text-primary hover:bg-primary/10"
                )}
              >
                {persona.is_active ? 'Pasifleştir' : 'Aktifleştir'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmTarget?.is_active ? 'Persona Pasifleştir' : 'Persona Aktifleştir'}
        description={`"${confirmTarget?.first_name || confirmTarget?.name}" personasını ${confirmTarget?.is_active ? 'pasifleştirmek' : 'aktifleştirmek'} istediğinize emin misiniz?`}
        variant={confirmTarget?.is_active ? 'destructive' : 'default'}
        onConfirm={() => {
          if (confirmTarget) {
            execute(confirmTarget.id, confirmTarget.is_active)
            setConfirmTarget(null)
          }
        }}
      />
    </>
  )
}
