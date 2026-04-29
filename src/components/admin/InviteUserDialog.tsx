'use client'

import { useRef, useState } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/lib/toast'

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)

  const { execute, isPending } = useServerAction(inviteUserAction, {
    onSuccess: () => {
      formRef.current?.reset()
      setError(null)
      onOpenChange(false)
      toast.success('Davet e-postası gönderildi.')
    },
    onError: (errorMessage) => {
      setError(errorMessage)
    },
  })

  function handleOpenChange(next: boolean) {
    if (!next) setError(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Kullanıcı Davet Et</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={(fd) => execute(fd)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="full_name">Ad Soyad *</Label>
              <Input id="full_name" name="full_name" placeholder="Ahmet Yılmaz" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Kullanıcı Adı</Label>
              <Input id="username" name="username" placeholder="ahmet.yilmaz" />
              <p className="text-xs text-muted-foreground">Küçük harf, rakam, nokta ve tire</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-posta *</Label>
              <Input id="email" name="email" type="email" placeholder="ahmet@sirket.com" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Ünvan</Label>
              <Input id="title" name="title" placeholder="Kıdemli Uzman" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Görevi</Label>
              <Input id="position" name="position" placeholder="Satış Temsilcisi" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Görev Alanı</Label>
              <Input id="department" name="department" placeholder="Satış" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol *</Label>
              <Select name="role" defaultValue="user">
                <SelectTrigger>
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hr_admin">İK Admin</SelectItem>
                  <SelectItem value="hr_viewer">İK Görüntüleyici</SelectItem>
                  <SelectItem value="manager">Yönetici</SelectItem>
                  <SelectItem value="user">Kullanıcı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Kullanıcıya e-posta ile davet linki gönderilir. Linke tıklayarak hesabını etkinleştirebilir.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton disabled={isPending}>Davet Gönder</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
