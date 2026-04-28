'use client'

import { useState } from 'react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog'
import { useServerAction } from '@/hooks/useServerAction'
import { toggleTenantStatusAction } from '@/lib/actions/tenant.actions'
import type { Tenant } from '@/types'
import { Building2 } from 'lucide-react'

interface RubricTemplateOption {
  id: string
  name: string
  is_default: boolean
}

interface TenantTableProps {
  tenants: Tenant[]
  rubricTemplates?: RubricTemplateOption[]
}

export function TenantTable({ tenants, rubricTemplates = [] }: TenantTableProps) {
  const [confirmTarget, setConfirmTarget] = useState<Tenant | null>(null)
  const [editTarget, setEditTarget] = useState<Tenant | null>(null)
  const { execute, isPending } = useServerAction(toggleTenantStatusAction)

  const columns: Column<Tenant>[] = [
    {
      key: 'logo_url',
      header: 'Logo',
      render: (row) => (
        <div className="flex h-12 w-20 items-center">
          {row.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.logo_url} alt={`${row.name} logosu`} className="h-full w-full object-contain object-left" />
          ) : (
            <Building2 className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      ),
    },
    { key: 'name', header: 'Ad' },
    { key: 'slug', header: 'Slug', render: (row) => (
      <span className="font-mono text-xs text-muted-foreground">{row.slug}</span>
    )},
    {
      key: 'is_active',
      header: 'Durum',
      render: (row) => <StatusBadge active={row.is_active} />,
    },
    {
      key: 'created_at',
      header: 'Oluşturulma',
      render: (row) => new Date(row.created_at).toLocaleDateString('tr-TR'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditTarget(row)}
          >
            Güncelle
          </Button>
          <Button
            variant="ghost"
            size="sm"
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
        data={tenants}
        columns={columns}
        searchKeys={['name', 'slug']}
        searchPlaceholder="Tenant ara..."
        emptyMessage="Henüz tenant yok."
      />
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmTarget?.is_active ? 'Tenant Pasifleştir' : 'Tenant Aktifleştir'}
        description={`"${confirmTarget?.name}" kurumunu ${confirmTarget?.is_active ? 'pasifleştirmek' : 'aktifleştirmek'} istediğinize emin misiniz?`}
        confirmLabel={confirmTarget?.is_active ? 'Pasifleştir' : 'Aktifleştir'}
        variant={confirmTarget?.is_active ? 'destructive' : 'default'}
        onConfirm={() => {
          if (confirmTarget) {
            execute(confirmTarget.id, confirmTarget.is_active)
            setConfirmTarget(null)
          }
        }}
      />
      <CreateTenantDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        tenant={editTarget}
        rubricTemplates={rubricTemplates}
      />
    </>
  )
}
