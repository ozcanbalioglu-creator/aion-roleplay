'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PersonaDetailSheet } from '@/components/admin/PersonaDetailSheet'
import { useServerAction } from '@/hooks/useServerAction'
import { togglePersonaStatusAction } from '@/lib/actions/persona.actions'
import { PencilIcon, UserCircle } from 'lucide-react'
import type { Persona } from '@/types'
import { cn } from '@/lib/utils'

const DIFFICULTY_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']

const GROWTH_TYPE_LABELS: Record<string, string> = {
  falling_performance:  'Düşen Performans',
  rising_performance:   'Yükselen Performans',
  resistant_experience: 'Dirençli Deneyim',
  new_to_role:          'Yeni Göreve Başlayan',
  motivation_crisis:    'Motivasyon Krizi',
}

interface PersonaGridProps {
  personas: Persona[]
  isSuperAdmin?: boolean
}

export function PersonaGrid({ personas, isSuperAdmin = false }: PersonaGridProps) {
  const [confirmTarget, setConfirmTarget] = useState<Persona | null>(null)
  const [detailPersona, setDetailPersona] = useState<Persona | null>(null)
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((persona) => {
          const difficultyValue = persona.difficulty ?? 0
          const growthLabel = GROWTH_TYPE_LABELS[(persona as any).growth_type] ?? null
          const description = persona.scenario_description

          return (
            <Card
              key={persona.id}
              onClick={() => setDetailPersona(persona)}
              className="overflow-hidden bg-card border-border/40 shadow-md hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer"
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
                    <div className="ml-auto">
                      <StatusBadge active={persona.is_active} />
                    </div>
                  </div>
                </div>

              </div>

              {isSuperAdmin && (
                <CardFooter className="gap-2 border-t border-border/20 px-6 py-3">
                  <span onClick={(e) => e.stopPropagation()}>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 rounded-full text-[9px] uppercase tracking-wider border-border/40 px-2"
                    >
                      <Link href={`/tenant/personas/${persona.id}/edit`}>
                        <PencilIcon className="mr-1 h-3 w-3" />
                        Düzenle
                      </Link>
                    </Button>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); setConfirmTarget(persona) }}
                    disabled={isPending}
                    className={cn(
                      'h-7 flex-1 rounded-full text-[9px] uppercase tracking-wider px-2',
                      persona.is_active
                        ? 'text-destructive hover:text-destructive hover:bg-destructive/10'
                        : 'text-primary hover:text-primary hover:bg-primary/10'
                    )}
                  >
                    {persona.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                  </Button>
                </CardFooter>
              )}
            </Card>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmTarget?.is_active ? 'Persona Pasifleştir' : 'Persona Aktifleştir'}
        description={`"${confirmTarget?.name}" personasını ${confirmTarget?.is_active ? 'pasifleştirmek' : 'aktifleştirmek'} istediğinize emin misiniz?`}
        variant={confirmTarget?.is_active ? 'destructive' : 'default'}
        onConfirm={() => {
          if (confirmTarget) {
            execute(confirmTarget.id, confirmTarget.is_active)
            setConfirmTarget(null)
          }
        }}
      />

      <PersonaDetailSheet
        persona={detailPersona}
        open={!!detailPersona}
        onOpenChange={(open) => !open && setDetailPersona(null)}
      />
    </>
  )
}
