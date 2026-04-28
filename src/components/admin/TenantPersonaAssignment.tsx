'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { assignPersonaToTenantAction, removePersonaFromTenantAction } from '@/lib/actions/persona.actions'
import { UserCircle, Building2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Persona, Tenant } from '@/types'

interface Mapping { persona_id: string; tenant_id: string; is_active: boolean }

interface TenantPersonaAssignmentProps {
  personas: Persona[]
  tenants: Tenant[]
  initialMappings: Mapping[]
}

const DIFFICULTY_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']

const PERSONALITY_LABELS: Record<string, string> = {
  resistant_experience: 'Dirençli Deneyim',
  rising_performance: 'Yükselen Performans',
  falling_performance: 'Düşen Performans',
  new_to_role: 'Yeni Göreve Başlayan',
  new_starter: 'Yeni Başlayan',
  motivation_crisis: 'Motivasyon Krizi',
  dominant: 'Baskın',
  compliant: 'Uyumlu',
  analytical: 'Analitik',
  expressive: 'Ekspresif',
  withdrawn: 'İçe Kapanık',
}

export function TenantPersonaAssignment({ personas, tenants, initialMappings }: TenantPersonaAssignmentProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenants[0]?.id ?? '')
  const [mappings, setMappings] = useState<Mapping[]>(initialMappings)
  const [loadingKey, setLoadingKey] = useState<string>('')
  const [, startTransition] = useTransition()

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId)
  const isAssigned = (personaId: string) =>
    mappings.some((m) => m.persona_id === personaId && m.tenant_id === selectedTenantId && m.is_active)
  const assignedCount = mappings.filter((m) => m.tenant_id === selectedTenantId && m.is_active).length

  const handleToggle = (personaId: string) => {
    if (!selectedTenantId) return
    setLoadingKey(personaId)
    startTransition(async () => {
      if (isAssigned(personaId)) {
        const result = await removePersonaFromTenantAction(personaId, selectedTenantId)
        if (result?.error) {
          toast.error(result.error)
        } else {
          setMappings((prev) => prev.filter((m) => !(m.persona_id === personaId && m.tenant_id === selectedTenantId)))
        }
      } else {
        const result = await assignPersonaToTenantAction(personaId, selectedTenantId)
        if (result?.error) {
          toast.error(result.error)
        } else {
          setMappings((prev) => [...prev, { persona_id: personaId, tenant_id: selectedTenantId, is_active: true }])
        }
      }
      setLoadingKey('')
    })
  }

  return (
    <div className="space-y-6">

      {/* ── Tenant Seçici ── */}
      <div className="flex flex-wrap gap-2">
        {tenants.map((tenant) => {
          const count = mappings.filter((m) => m.tenant_id === tenant.id && m.is_active).length
          const active = selectedTenantId === tenant.id
          return (
            <button
              key={tenant.id}
              onClick={() => setSelectedTenantId(tenant.id)}
              className={cn(
                'flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition-all',
                active
                  ? 'border-sidebar-primary bg-sidebar-primary text-white shadow-md'
                  : 'border-border bg-card text-foreground hover:border-sidebar-primary/50'
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              {tenant.name}
              <span className={cn(
                'ml-1 rounded-full px-1.5 py-0 text-[10px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Seçili Tenant Başlık ── */}
      {selectedTenant && (
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3">
          <div>
            <p className="font-semibold">{selectedTenant.name}</p>
            <p className="text-xs text-muted-foreground">
              {assignedCount} persona atanmış • Kartı tıklayarak ekle / çıkar
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 mr-1 align-middle" />Atandı
            <span className="ml-3 inline-block h-3 w-3 rounded-full border-2 border-border mr-1 align-middle" />Atanmadı
          </p>
        </div>
      )}

      {/* ── Persona Kartları ── */}
      {!selectedTenantId ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Yukarıdan bir şirket seçin.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((persona) => {
            const assigned = isAssigned(persona.id)
            const loading = loadingKey === persona.id
            const displayName = persona.name
            const personalityLabel = PERSONALITY_LABELS[persona.personality_type] ?? persona.personality_type

            return (
              <button
                key={persona.id}
                onClick={() => handleToggle(persona.id)}
                disabled={loading}
                className={cn(
                  'group relative w-full overflow-hidden rounded-xl border-2 text-left transition-all disabled:opacity-60',
                  assigned
                    ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100 hover:shadow-lg dark:bg-emerald-950/20 dark:shadow-emerald-900/20'
                    : 'border-border bg-card shadow-sm hover:border-slate-400 hover:shadow-md'
                )}
              >
                <div className="flex h-24">

                  {/* Kolon 1: Fotoğraf */}
                  <div className="w-20 shrink-0">
                    {persona.avatar_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={persona.avatar_image_url} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className={cn(
                        'flex h-full w-full items-center justify-center transition-colors',
                        assigned
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {displayName?.[0]
                          ? <span className="text-2xl font-bold uppercase">{displayName[0]}</span>
                          : <UserCircle className="h-8 w-8" />
                        }
                      </div>
                    )}
                  </div>

                  {/* Kolon 2: Kimlik */}
                  <div className="flex flex-1 flex-col justify-between border-x border-border/20 px-3 py-2.5 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <p className="truncate font-semibold text-sm">{displayName}</p>
                      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{persona.title}</p>
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">{personalityLabel}</p>
                  </div>

                  {/* Kolon 3: Zorluk + Durum */}
                  <div className="flex w-20 shrink-0 flex-col justify-between px-2.5 py-2.5">
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Zorluk</p>
                      <span className="flex flex-wrap gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            i < (persona.difficulty ?? 0) ? DIFFICULTY_COLORS[persona.difficulty ?? 0] : 'bg-muted'
                          )} />
                        ))}
                      </span>
                    </div>

                    {/* Atandı işareti VEYA yıl */}
                    {assigned ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : persona.experience_years ? (
                      <div>
                        <p className="text-xs font-semibold">{persona.experience_years}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Yıl</p>
                      </div>
                    ) : null}
                  </div>

                </div>

                {/* Loading overlay */}
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
