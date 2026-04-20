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

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ email: string; tempPassword: string } | null>(null)

  const { execute, isPending } = useServerAction(inviteUserAction, {
    onSuccess: (result: any) => {
      if (result?.tempPassword) {
        setSuccessData({ email: result.email || '', tempPassword: result.tempPassword })
      } else {
        formRef.current?.reset()
        setError(null)
        onOpenChange(false)
      }
    },
    onError: (errorMessage) => {
      setError(errorMessage)
      console.error('Kullanıcı davet hatası:', errorMessage)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kullanıcı Davet Et</DialogTitle>
        </DialogHeader>
        {successData ? (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                ✅ Kullanıcı başarıyla oluşturuldu!
              </AlertDescription>
            </Alert>

            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">E-posta:</p>
              <p className="text-sm font-mono">{successData.email}</p>

              <p className="text-sm font-medium mt-3">Geçici Şifre:</p>
              <div className="flex gap-2 items-center">
                <p className="text-sm font-mono flex-1 break-all">{successData.tempPassword}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(successData.tempPassword)
                  }}
                  className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
                >
                  Kopyala
                </button>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                💡 Kullanıcıya bu bilgileri verin. İlk girişte şifrelerini değiştirebilecekler.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSuccessData(null)
                formRef.current?.reset()
                onOpenChange(false)
              }}
              className="w-full px-3 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              Kapat
            </button>
          </div>
        ) : (
          <form ref={formRef} action={(fd) => execute(fd)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
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
        )}
      </DialogContent>
    </Dialog>
  )
}
