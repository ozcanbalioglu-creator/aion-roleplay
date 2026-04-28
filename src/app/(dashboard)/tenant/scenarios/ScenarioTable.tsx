'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useServerAction } from '@/hooks/useServerAction'
import { toggleScenarioStatusAction } from '@/lib/actions/scenario.actions'
import { PencilIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScenarioDetailSheet } from '@/components/admin/ScenarioDetailSheet'
import type { Scenario } from '@/types'

type ScenarioWithPersona = Scenario & {
  personas?: { name: string; personality_type: string; avatar_image_url?: string | null } | null
}

interface ScenarioTableProps {
  scenarios: ScenarioWithPersona[]
  isSuperAdmin?: boolean
  canToggle?: boolean
}

export function ScenarioTable({ scenarios, isSuperAdmin = false, canToggle = false }: ScenarioTableProps) {
  const [confirmTarget, setConfirmTarget] = useState<ScenarioWithPersona | null>(null)
  const [detailScenario, setDetailScenario] = useState<ScenarioWithPersona | null>(null)
  const { execute, isPending } = useServerAction(toggleScenarioStatusAction)

  const columns: Column<ScenarioWithPersona>[] = [
    {
      key: 'title',
      header: 'Başlık',
      render: (row) => (
        <button
          className="text-left"
          onClick={() => setDetailScenario(row)}
        >
          <p className="font-medium hover:text-primary transition-colors">{row.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{row.description}</p>
        </button>
      ),
    },
    {
      key: 'personas',
      header: 'Persona',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.personas?.avatar_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.personas.avatar_image_url}
              alt={row.personas.name}
              className="h-7 w-7 rounded-full object-cover object-[center_15%] shrink-0"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary uppercase">
                {row.personas?.name?.[0] ?? '?'}
              </span>
            </div>
          )}
          <span className="text-sm">{row.personas?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'difficulty_level',
      header: 'Zorluk',
      render: (row) => {
        const level = row.difficulty_level ?? 0
        const colors = ['', 'text-green-500', 'text-lime-500', 'text-yellow-500', 'text-orange-500', 'text-red-500']
        const labels = ['', 'Kolay', 'Orta-Alt', 'Orta', 'Zor', 'Çok Zor']
        return (
          <div className="flex flex-col gap-0.5">
            <span className={cn('font-semibold text-sm', colors[level] ?? 'text-muted-foreground')}>
              {'●'.repeat(level)}{'○'.repeat(5 - level)}
            </span>
            <span className="text-[10px] text-muted-foreground">{labels[level] ?? ''}</span>
          </div>
        )
      },
    },
    {
      key: 'is_active',
      header: 'Durum',
      render: (row) => <StatusBadge active={row.is_active} />,
    },
    ...(canToggle ? [{
      key: 'actions' as const,
      header: '',
      render: (row: ScenarioWithPersona) => (
        <div className="flex gap-1">
          {isSuperAdmin && (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/tenant/scenarios/${row.id}/edit`}>
                <PencilIcon className="h-4 w-4" />
              </Link>
            </Button>
          )}
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
    }] : []),
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
      <ScenarioDetailSheet
        scenario={detailScenario}
        open={!!detailScenario}
        onOpenChange={(open) => !open && setDetailScenario(null)}
      />
    </>
  )
}
