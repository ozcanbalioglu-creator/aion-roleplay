'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EditUserDialog } from '@/components/admin/EditUserDialog'
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
import { toggleUserStatusAction, updateUserRoleAction, deleteUserAction } from '@/lib/actions/user.actions'
import type { AppUser, UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Süper Admin',
  tenant_admin: 'Kurum Admin',
  hr_admin: 'İK Admin',
  hr_viewer: 'İK Görüntüleyici',
  manager: 'Yönetici',
  user: 'Kullanıcı',
}

const ROLE_VARIANTS: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  super_admin: 'default',
  tenant_admin: 'secondary',
  hr_admin: 'secondary',
  hr_viewer: 'secondary',
  manager: 'secondary',
  user: 'outline',
}

interface UserTableProps {
  users: AppUser[]
  currentUserId: string
  canManage?: boolean
}

export function UserTable({ users, currentUserId, canManage = false }: UserTableProps) {
  const [confirmTarget, setConfirmTarget] = useState<AppUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [editTarget, setEditTarget] = useState<AppUser | null>(null)
  const { execute: executeRole } = useServerAction(updateUserRoleAction)
  const { execute: executeStatus, isPending } = useServerAction(toggleUserStatusAction)
  const { execute: executeDelete, isPending: isDeleting } = useServerAction(deleteUserAction)

  const columns: Column<AppUser>[] = [
    {
      key: 'full_name',
      header: 'Ad Soyad',
      render: (row) => (
        <div>
          <Link href={`/tenant/users/${row.id}`} className="font-medium hover:underline">
            {row.full_name}
          </Link>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (row) => (
        !canManage || row.id === currentUserId ? (
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
    ...(canManage ? [{
      key: 'actions' as const,
      header: '',
      render: (row: AppUser) =>
        row.id !== currentUserId ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(row)}>
              Düzenle
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmTarget(row)}
              disabled={isPending}
            >
              {row.is_active ? 'Pasifleştir' : 'Aktifleştir'}
            </Button>
            {!row.is_active && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteTarget(row)}
                disabled={isDeleting}
              >
                Sil
              </Button>
            )}
          </div>
        ) : null,
    }] : []),
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
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Kullanıcıyı Sil"
        description={`"${deleteTarget?.full_name}" kullanıcısını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) {
            executeDelete(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
      />
      <EditUserDialog
        user={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />
    </>
  )
}
