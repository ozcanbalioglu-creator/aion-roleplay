'use client'

import { useState } from 'react'
import { Building2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useServerAction } from '@/hooks/useServerAction'
import { assignRubricToTenantAction, unassignRubricFromTenantAction } from '@/lib/actions/rubric.actions'
import { toast } from '@/lib/toast'

interface Tenant {
  id: string
  name: string
  rubric_template_id: string | null
}

interface Props {
  templateId: string
  assigned: Tenant[]
  unassigned: Tenant[]
}

export function RubricTenantAssignment({ templateId, assigned, unassigned }: Props) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [assignedList, setAssignedList] = useState(assigned)
  const [unassignedList, setUnassignedList] = useState(unassigned)

  const { execute: assign, isPending: assigning } = useServerAction(assignRubricToTenantAction, {
    onSuccess: () => {
      const tenant = unassignedList.find((t) => t.id === selectedTenantId)
      if (tenant) {
        setAssignedList((prev) => [...prev, { ...tenant, rubric_template_id: templateId }])
        setUnassignedList((prev) => prev.filter((t) => t.id !== selectedTenantId))
        setSelectedTenantId('')
        toast.success(`${tenant.name} bu rubric'e atandı.`)
      }
    },
    onError: (err) => toast.error(err),
  })

  const { execute: doUnassign } = useServerAction(unassignRubricFromTenantAction, {
    onError: (err) => toast.error(err),
  })

  function handleUnassign(tenant: Tenant) {
    setUnassignedList((prev) => [...prev, { ...tenant, rubric_template_id: null }])
    setAssignedList((prev) => prev.filter((t) => t.id !== tenant.id))
    toast.success(`${tenant.name} rubric ataması kaldırıldı.`)
    doUnassign(tenant.id)
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Tenant Atamaları</h2>
        <Badge variant="secondary" className="text-[10px]">{assignedList.length} tenant</Badge>
      </div>

      {assignedList.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {assignedList.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium px-3 py-1"
            >
              {t.name}
              <button
                type="button"
                onClick={() => handleUnassign(t)}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Bu rubric henüz hiçbir tenant&apos;a atanmamış.</p>
      )}

      {unassignedList.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger className="h-8 text-xs w-56">
              <SelectValue placeholder="Tenant seç" />
            </SelectTrigger>
            <SelectContent>
              {unassignedList.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            disabled={!selectedTenantId || assigning}
            onClick={() => assign(templateId, selectedTenantId)}
          >
            <Plus className="h-3 w-3" />
            Ata
          </Button>
        </div>
      )}
    </div>
  )
}
