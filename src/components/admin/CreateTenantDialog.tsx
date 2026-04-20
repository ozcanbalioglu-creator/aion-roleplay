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
import { SubmitButton } from '@/components/ui/SubmitButton'
import { useServerAction } from '@/hooks/useServerAction'
import { createTenantAction } from '@/lib/actions/tenant.actions'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CreateTenantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function CreateTenantDialog({ open, onOpenChange }: CreateTenantDialogProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const slugRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const { execute, isPending } = useServerAction(createTenantAction, {
    onSuccess: () => {
      formRef.current?.reset()
      setError(null)
      onOpenChange(false)
    },
    onError: (errorMessage) => {
      setError(errorMessage)
      console.error('Tenant oluşturma hatası:', errorMessage)
    }
  })

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (slugRef.current && !slugRef.current.dataset.edited) {
      slugRef.current.value = slugify(e.target.value)
    }
  }

  function handleFormAction(formData: FormData) {
    execute(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Tenant Oluştur</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleFormAction} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Kurum Adı</Label>
            <Input
              id="name"
              name="name"
              placeholder="Örn: Acme Şirketi"
              onChange={handleNameChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL Adresi)</Label>
            <Input
              id="slug"
              name="slug"
              placeholder="ornek-sirket"
              ref={slugRef}
              onChange={() => {
                if (slugRef.current) {
                  slugRef.current.value = slugify(slugRef.current.value)
                  slugRef.current.dataset.edited = 'true'
                }
              }}
              required
            />
            <p className="text-xs text-muted-foreground">
              Otomatik: boşluk ve özel karakterler kaldırılır. Küçük harf ve tire kullanılır.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand_color">Marka Rengi</Label>
            <Input
              id="brand_color"
              name="brand_color"
              type="color"
              defaultValue="#4F46E5"
              className="h-10 w-20 p-1"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm mb-3">Tenant Admin Bilgileri</h3>

            <div className="space-y-2">
              <Label htmlFor="admin_full_name">Admin Adı Soyadı</Label>
              <Input
                id="admin_full_name"
                name="admin_full_name"
                placeholder="Örn: Ahmet Yılmaz"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_email">Admin E-posta</Label>
              <Input
                id="admin_email"
                name="admin_email"
                type="email"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_password">Admin Şifre</Label>
              <Input
                id="admin_password"
                name="admin_password"
                type="password"
                placeholder="En az 8 karakter"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton disabled={isPending}>Oluştur</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
