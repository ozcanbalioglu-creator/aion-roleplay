'use client'

import { useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { useServerAction } from '@/hooks/useServerAction'
import { inviteUserAction } from '@/lib/actions/user.actions'

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const { execute, isPending } = useServerAction(inviteUserAction, {
    onSuccess: () => {
      formRef.current?.reset()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kullanıcı Davet Et</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={(fd) => execute(fd)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Ad Soyad</Label>
            <Input id="full_name" name="full_name" placeholder="Ad Soyad" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="ornek@sirket.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select name="role" defaultValue="user">
              <SelectTrigger>
                <SelectValue placeholder="Rol seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant_admin">Kurum Admin</SelectItem>
                <SelectItem value="hr_admin">İK Admin</SelectItem>
                <SelectItem value="manager">Yönetici</SelectItem>
                <SelectItem value="user">Kullanıcı</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton disabled={isPending}>Davet Gönder</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
