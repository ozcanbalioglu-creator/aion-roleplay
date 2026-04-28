'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { assignPersonaToTenantAction, removePersonaFromTenantAction } from '@/lib/actions/persona.actions'
import type { Persona, Tenant } from '@/types'

interface Mapping { persona_id: string; tenant_id: string; is_active: boolean }

interface PersonaTenantAssignmentProps {
  personas: Persona[]
  tenants: Tenant[]
  initialMappings: Mapping[]
}

export function PersonaTenantAssignment({ personas, tenants, initialMappings }: PersonaTenantAssignmentProps) {
  const [mappings, setMappings] = useState<Mapping[]>(initialMappings)
  const [pending, startTransition] = useTransition()
  const [loadingKey, setLoadingKey] = useState<string>('')

  const isAssigned = (personaId: string, tenantId: string) =>
    mappings.some((m) => m.persona_id === personaId && m.tenant_id === tenantId && m.is_active)

  const handleToggle = (personaId: string, tenantId: string) => {
    const key = `${personaId}-${tenantId}`
    setLoadingKey(key)

    startTransition(async () => {
      if (isAssigned(personaId, tenantId)) {
        await removePersonaFromTenantAction(personaId, tenantId)
        setMappings((prev) => prev.filter((m) => !(m.persona_id === personaId && m.tenant_id === tenantId)))
      } else {
        await assignPersonaToTenantAction(personaId, tenantId)
        setMappings((prev) => [...prev, { persona_id: personaId, tenant_id: tenantId, is_active: true }])
      }
      setLoadingKey('')
    })
  }

  return (
    <div className="space-y-4">
      {personas.map((persona) => {
        const displayName = persona.name
        return (
          <Card key={persona.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{displayName}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{persona.title}</p>
                </div>
                <Badge variant="outline">Zorluk: {persona.difficulty}/5</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {tenants.map((tenant) => {
                  const assigned = isAssigned(persona.id, tenant.id)
                  const isLoading = loadingKey === `${persona.id}-${tenant.id}` && pending
                  return (
                    <button
                      key={tenant.id}
                      onClick={() => handleToggle(persona.id, tenant.id)}
                      disabled={isLoading}
                      className={`rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-all disabled:opacity-50 ${
                        assigned
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card hover:border-primary/40 text-foreground'
                      }`}
                    >
                      {isLoading ? '...' : assigned ? '✓ ' : ''}{tenant.name}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
