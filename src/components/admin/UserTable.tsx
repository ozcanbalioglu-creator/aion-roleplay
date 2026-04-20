'use client'

import { useState } from 'react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useServerAction } from '@/hooks/useServerAction'
import { updateUserRoleAction, toggleUserStatusAction } from '@/lib/actions/user.actions'
import type { AppUser, UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Süper Admin',
  tenant_admin: 'Kurum Admin',
  hr_admin: 'İK Admin',
  manager: 'Yönetici',
  user: 'Kullanıcı',
}

const ROLE_VARIANTS: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  super_admin: 'default',
  tenant_admin: 'default',
  hr_admin: 'secondary',
  manager: 'secondary',
  user: 'outline',
}

interface UserTableProps {
  users: AppUser[]
  currentUserId: string
}

export function UserTable({ users, currentUserId }: UserTableProps) {
  const [confirmTarget, setConfirmTarget] = useState<AppUser | null>(null)
  const { execute: executeRole } = useServerAction(updateUserRoleAction)
  const { execute: executeStatus, isPending } = useServerAction(toggleUserStatusAction)

  const columns: Column<AppUser>[] = [
    {
      key: 'full_name',
      header: 'Ad Soyad',
      render: (row) => (
        <div>
          <p className="font-medium">{row.full_name}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (row) => (
        row.id === currentUserId ? (
          <Badge variant={ROLE_VARIANTS[row.role]}>{ROLE_LABELS[row.role]}</Badge>
        ) : (
          <Select
            defaultValue={row.role}
            onValueChange={(value) => executeRole(row.id, value as UserRole)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as UserRole[])
                .filter((r) => r !== 'super_admin')
                .map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        )
      ),
    },
    {
      key: 'is_active',
      header: 'Durum',
      render: (row) => <StatusBadge active={row.is_active} />,
    },
    {
      key: 'created_at',
      header: 'Eklenme',
      render: (row) => new Date(row.created_at).toLocaleDateString('tr-TR'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.id !== currentUserId ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmTarget(row)}
            disabled={isPending}
          >
            {row.is_active ? 'Pasifleştir' : 'Aktifleştir'}
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <DataTable
        data={users}
        columns={columns}
        searchKeys={['full_name', 'email']}
        searchPlaceholder="Kullanıcı ara..."
        emptyMessage="Henüz kullanıcı yok."
      />
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmTarget?.is_active ? 'Kullanıcı Pasifleştir' : 'Kullanıcı Aktifleştir'}
        description={`"${confirmTarget?.full_name}" kullanıcısını ${confirmTarget?.is_active ? 'pasifleştirmek' : 'aktifleştirmek'} istediğinize emin misiniz?`}
        variant={confirmTarget?.is_active ? 'destructive' : 'default'}
        onConfirm={() => {
          if (confirmTarget) {
            executeStatus(confirmTarget.id, confirmTarget.is_active)
            setConfirmTarget(null)
          }
        }}
      />
    </>
  )
}
