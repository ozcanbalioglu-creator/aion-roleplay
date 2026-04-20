'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const CreateTenantSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug sadece küçük harf, rakam ve tire içerebilir'),
  brand_color: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
})

export async function createTenantAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    brand_color: formData.get('brand_color') as string | undefined,
    logo_url: formData.get('logo_url') as string | undefined,
  }

  const parsed = CreateTenantSchema.safeParse(raw)
  if (!parsed.success) {
    const errors = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
    console.error('Validation errors:', errors, 'Raw data:', raw)
    return { error: errors || 'Geçersiz girdi' }
  }

  const supabase = await createServiceClient()

  const { error: existsError, data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', parsed.data.slug)
    .maybeSingle()

  if (existsError) return { error: 'Kontrol hatası.' }
  if (existing) return { error: 'Bu slug zaten kullanılıyor.' }

  const { error } = await supabase.from('tenants').insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    brand_color: parsed.data.brand_color || null,
    logo_url: parsed.data.logo_url || null,
    is_active: true,
  })

  if (error) return { error: 'Tenant oluşturulamadı: ' + error.message }

  revalidatePath('/admin/tenants')
  return { success: 'Tenant başarıyla oluşturuldu.' }
}

export async function toggleTenantStatusAction(tenantId: string, isActive: boolean) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('tenants')
    .update({ is_active: !isActive })
    .eq('id', tenantId)

  if (error) return { error: 'Durum güncellenemedi.' }

  revalidatePath('/admin/tenants')
  return { success: `Tenant ${!isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.` }
}

export async function getTenants() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}
