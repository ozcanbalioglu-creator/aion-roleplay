'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
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
          const displayName = persona.name

          return (
            <Card
              key={persona.id}
              onClick={() => setDetailPersona(persona)}
              className="overflow-hidden bg-card border-border/40 shadow-md hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer"
            >
              {/* ── 3 Kolon: Foto | Kimlik | Detay ── */}
              <CardContent className="p-0">
                <div className="flex h-28">

                  {/* Kolon 1: Fotoğraf */}
                  <div className="w-20 shrink-0 overflow-hidden">
                    {persona.avatar_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={persona.avatar_image_url}
                        alt={displayName}
                        className="h-full w-full object-cover object-[center_15%]"
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

                  {/* Kolon 2: Ad / Ünvan / Durum */}
                  <div className="flex flex-1 flex-col justify-between border-x border-border/20 px-3 py-2.5 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate leading-tight">
                        {persona.title}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {persona.personality_type && (
                        <p className="text-[10px] text-muted-foreground truncate">{persona.personality_type}</p>
                      )}
                      <StatusBadge active={persona.is_active} />
                    </div>
                  </div>

                  {/* Kolon 3: Zorluk / Tecrübe */}
                  <div className="flex w-20 shrink-0 flex-col justify-between px-2.5 py-2.5">
                    <div className="space-y-1">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Zorluk</p>
                      <span className="flex flex-wrap gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              i < (persona.difficulty ?? 0)
                                ? DIFFICULTY_COLORS[persona.difficulty ?? 0]
                                : 'bg-muted'
                            )}
                          />
                        ))}
                      </span>
                    </div>
                    {persona.experience_years ? (
                      <div>
                        <p className="text-xs font-semibold">{persona.experience_years}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Yıl</p>
                      </div>
                    ) : null}
                  </div>

                </div>
              </CardContent>

              {isSuperAdmin && (
                <CardFooter className="gap-2 border-t border-border/20 p-2">
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
