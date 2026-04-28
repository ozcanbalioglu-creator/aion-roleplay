'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useServerAction } from '@/hooks/useServerAction'
import { updateTenantContextAction } from '@/lib/actions/tenant.actions'
import type { TenantContextProfile } from '@/types'

interface TenantContextFormProps {
  tenantId: string
  initialProfile?: TenantContextProfile | null
}

export function TenantContextForm({ tenantId, initialProfile }: TenantContextFormProps) {
  const { execute, isPending } = useServerAction(updateTenantContextAction)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('tenant_id', tenantId)
    execute(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="company_description">Şirket Açıklaması</Label>
        <Textarea
          id="company_description"
          name="company_description"
          placeholder="Şirketin genel tanımı, faaliyet alanı..."
          rows={3}
          defaultValue={initialProfile?.company_description ?? ''}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="industry">Sektör</Label>
          <Input
            id="industry"
            name="industry"
            placeholder="ör: Perakende, Finans, Üretim..."
            defaultValue={initialProfile?.industry ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_size">Şirket Büyüklüğü</Label>
          <Input
            id="company_size"
            name="company_size"
            placeholder="ör: 500 çalışan, KOBİ, Global..."
            defaultValue={initialProfile?.company_size ?? ''}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product_summary">Ürün / Hizmet Özeti</Label>
        <Textarea
          id="product_summary"
          name="product_summary"
          placeholder="Şirketin sunduğu ürün veya hizmetlerin kısa özeti..."
          rows={3}
          defaultValue={initialProfile?.product_summary ?? ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="culture_notes">Şirket Kültürü Notları</Label>
        <Textarea
          id="culture_notes"
          name="culture_notes"
          placeholder="Kurumun iletişim tarzı, değerleri, beklentileri..."
          rows={3}
          defaultValue={initialProfile?.culture_notes ?? ''}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Bu bilgiler AI roleplay konuşmalarına otomatik olarak eklenir ve senaryoların daha gerçekçi hissettirmesini sağlar. Gizli bilgiler yazmaktan kaçının.
      </p>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Kaydediliyor...' : 'Kaydet'}
      </Button>
    </form>
  )
}
