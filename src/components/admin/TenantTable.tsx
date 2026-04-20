'use client'

import { useState } from 'react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useServerAction } from '@/hooks/useServerAction'
import { toggleTenantStatusAction } from '@/lib/actions/tenant.actions'
import type { Tenant } from '@/types'

interface TenantTableProps {
  tenants: Tenant[]
}

export function TenantTable({ tenants }: TenantTableProps) {
  const [confirmTarget, setConfirmTarget] = useState<Tenant | null>(null)
  const { execute, isPending } = useServerAction(toggleTenantStatusAction)

  const columns: Column<Tenant>[] = [
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmTarget(row)}
          disabled={isPending}
        >
          {row.is_active ? 'Pasifleştir' : 'Aktifleştir'}
        </Button>
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
    </>
  )
}
