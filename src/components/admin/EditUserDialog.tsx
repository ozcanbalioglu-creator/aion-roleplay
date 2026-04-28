'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateUserProfileAction } from '@/lib/actions/user.actions'
import type { AppUser } from '@/types'

interface EditUserDialogProps {
  user: AppUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const [isPending, setIsPending] = useState(false)

  if (!user) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    setIsPending(true)
    const fd = new FormData(e.currentTarget)
    const res = await updateUserProfileAction(user.id, {
      full_name: fd.get('full_name') as string || undefined,
      title: fd.get('title') as string || undefined,
      position: fd.get('position') as string || undefined,
      department: fd.get('department') as string || undefined,
    })
    setIsPending(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(res.success)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kullanıcı Düzenle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-fullname">Ad Soyad</Label>
            <Input id="edit-fullname" name="full_name" defaultValue={user.full_name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Ünvan</Label>
            <Input id="edit-title" name="title" defaultValue={user.title ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-position">Pozisyon</Label>
            <Input id="edit-position" name="position" defaultValue={user.position ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-department">Departman</Label>
            <Input id="edit-department" name="department" defaultValue={user.department ?? ''} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
