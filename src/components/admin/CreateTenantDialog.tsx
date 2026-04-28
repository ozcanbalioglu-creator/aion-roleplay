'use client'

import { useRef, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { useServerAction } from '@/hooks/useServerAction'
import { createTenantAction, updateTenantAction } from '@/lib/actions/tenant.actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Tenant } from '@/types'
import { Building2, ImageIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RubricTemplateOption {
  id: string
  name: string
  is_default: boolean
}

interface CreateTenantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant?: Tenant | null
  rubricTemplates?: RubricTemplateOption[]
}

const INPUT_CLASS = '!bg-[#f5f2ff] border-transparent focus-visible:ring-primary/30'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function CreateTenantDialog({ open, onOpenChange, tenant, rubricTemplates = [] }: CreateTenantDialogProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const slugRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const NONE = '__none__'
  const [selectedTemplate, setSelectedTemplate] = useState<string>(tenant?.rubric_template_id ?? NONE)

  const isEdit = Boolean(tenant)
  const action = isEdit ? updateTenantAction : createTenantAction

  const { execute, isPending } = useServerAction(action, {
    onSuccess: () => {
      formRef.current?.reset()
      setError(null)
      setLogoPreview(null)
      onOpenChange(false)
    },
    onError: (errorMessage) => {
      setError(errorMessage)
    },
  })

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null)
      setLogoPreview(null)
    }
    onOpenChange(nextOpen)
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isEdit && slugRef.current && !slugRef.current.dataset.edited) {
      slugRef.current.value = slugify(e.target.value)
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoPreview(URL.createObjectURL(file))
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <SheetTitle>{isEdit ? 'Tenant Güncelle' : 'Yeni Tenant Oluştur'}</SheetTitle>
          <SheetDescription>
            Kurum bilgilerini, marka detaylarını ve yönetici hesabını yapılandırın.
          </SheetDescription>
        </SheetHeader>

        <form ref={formRef} action={(formData) => execute(formData)} className="mt-6 space-y-5">
          {tenant && (
            <>
              <input type="hidden" name="id" value={tenant.id} />
              <input type="hidden" name="existing_logo_url" value={tenant.logo_url ?? ''} />
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Kurum Bilgileri</h3>
              <p className="text-xs text-muted-foreground">Temel tenant ve marka bilgileri.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-name">Kurum Adı</Label>
              <Input
                id="tenant-name"
                name="name"
                defaultValue={tenant?.name ?? ''}
                placeholder="Örn: Acme Şirketi"
                onChange={handleNameChange}
                className={INPUT_CLASS}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-slug">Slug</Label>
              <Input
                id="tenant-slug"
                name="slug"
                defaultValue={tenant?.slug ?? ''}
                placeholder="ornek-sirket"
                ref={slugRef}
                onChange={() => {
                  if (slugRef.current) {
                    slugRef.current.value = slugify(slugRef.current.value)
                    slugRef.current.dataset.edited = 'true'
                  }
                }}
                className={INPUT_CLASS}
                required
              />
              <p className="text-xs text-muted-foreground">
                Küçük harf, rakam ve tire kullanılır.
              </p>
            </div>

            {rubricTemplates.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="rubric-template">Değerlendirme Rubric&apos;i</Label>
                <input
                  type="hidden"
                  name="rubric_template_id"
                  value={selectedTemplate === NONE ? '' : selectedTemplate}
                />
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                >
                  <SelectTrigger id="rubric-template" className={INPUT_CLASS}>
                    <SelectValue placeholder="Varsayılan template kullanılır" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Varsayılan (is_default)</SelectItem>
                    {rubricTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.is_default ? ' (Varsayılan)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Atanmazsa, platform varsayılan template&apos;i kullanılır.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="website-url">Şirket Web Adresi</Label>
              <Input
                id="website-url"
                name="website_url"
                type="url"
                defaultValue={tenant?.website_url ?? ''}
                placeholder="https://www.sirket.com"
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand-color">Marka Rengi</Label>
                <Input
                  id="brand-color"
                  name="brand_color"
                  type="color"
                  defaultValue={tenant?.brand_color ?? '#4F46E5'}
                  className="h-11 w-full !bg-[#f5f2ff] p-1"
                />
              </div>
              <div className="space-y-2">
                <Label>Önizleme</Label>
                <div
                  className="h-11 w-20 rounded-md border"
                  style={{ backgroundColor: tenant?.brand_color ?? '#4F46E5' }}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="text-sm font-semibold">Şirket Logosu</h3>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP veya SVG. Maksimum 2MB.</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border !bg-[#f5f2ff]">
                {logoPreview || tenant?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview ?? tenant?.logo_url ?? ''} alt="Tenant logosu" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <Input
                name="logo_file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={handleLogoChange}
                className={INPUT_CLASS}
              />
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="text-sm font-semibold">Tenant Admin Bilgileri</h3>
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? 'Kurum yöneticisinin profil bilgilerini güncelleyin. Şifre boş bırakılırsa değişmez.'
                  : 'İlk kurum yöneticisi bu bilgilerle oluşturulur.'}
              </p>
            </div>

            {tenant?.admin_user?.id && (
              <input type="hidden" name="admin_user_id" value={tenant.admin_user.id} />
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-full-name">Admin Adı Soyadı</Label>
              <Input
                id="admin-full-name"
                name="admin_full_name"
                defaultValue={tenant?.admin_user?.full_name ?? ''}
                placeholder="Örn: Ahmet Yılmaz"
                className={INPUT_CLASS}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin E-posta</Label>
              <Input
                id="admin-email"
                name="admin_email"
                type="email"
                defaultValue={tenant?.admin_user?.email ?? ''}
                placeholder="admin@example.com"
                className={INPUT_CLASS}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-position">Admin Görevi</Label>
              <Input
                id="admin-position"
                name="admin_position"
                defaultValue={tenant?.admin_user?.position ?? ''}
                placeholder="Örn: İnsan Kaynakları Direktörü"
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Admin Şifre</Label>
              <Input
                id="admin-password"
                name="admin_password"
                type="password"
                placeholder={isEdit ? 'Değiştirmek istemiyorsanız boş bırakın' : 'En az 8 karakter'}
                className={INPUT_CLASS}
                required={!isEdit || !tenant?.admin_user?.id}
              />
            </div>
          </section>

          <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t bg-background px-6 py-4">
            <SubmitButton disabled={isPending}>
              {isEdit ? 'Güncelle' : 'Oluştur'}
            </SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
