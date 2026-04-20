'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useServerAction } from '@/hooks/useServerAction'
import { toggleScenarioStatusAction } from '@/lib/actions/scenario.actions'
import { PencilIcon } from 'lucide-react'
import type { Scenario } from '@/types'

type ScenarioWithPersona = Scenario & {
  personas?: { name: string; personality_type: string } | null
}

interface ScenarioTableProps {
  scenarios: ScenarioWithPersona[]
}

export function ScenarioTable({ scenarios }: ScenarioTableProps) {
  const [confirmTarget, setConfirmTarget] = useState<ScenarioWithPersona | null>(null)
  const { execute, isPending } = useServerAction(toggleScenarioStatusAction)

  const columns: Column<ScenarioWithPersona>[] = [
    {
      key: 'title',
      header: 'Başlık',
      render: (row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'personas',
      header: 'Persona',
      render: (row) => (
        <span className="text-sm">{row.personas?.name ?? '—'}</span>
      ),
    },
    {
      key: 'difficulty_level',
      header: 'Zorluk',
      render: (row) => (
        <Badge variant="outline">{row.difficulty_level} / 5</Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Durum',
      render: (row) => <StatusBadge active={row.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/tenant/scenarios/${row.id}/edit`}>
              <PencilIcon className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmTarget(row)}
            disabled={isPending}
          >
            {row.is_active ? 'Pasifleştir' : 'Aktifleştir'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        data={scenarios}
        columns={columns}
        searchKeys={['title', 'description']}
        searchPlaceholder="Senaryo ara..."
        emptyMessage="Henüz senaryo yok."
      />
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmTarget?.is_active ? 'Senaryo Pasifleştir' : 'Senaryo Aktifleştir'}
        description={`"${confirmTarget?.title}" senaryosunu ${confirmTarget?.is_active ? 'pasifleştirmek' : 'aktifleştirmek'} istediğinize emin misiniz?`}
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
