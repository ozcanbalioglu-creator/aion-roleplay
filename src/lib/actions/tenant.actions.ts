'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const CreateTenantSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug sadece küçük harf, rakam ve tire içerebilir'),
  brand_color: z.string().optional(),
  logo_url: z.string().url().or(z.literal('')).optional(),
  admin_full_name: z.string().min(2, 'Ad-soyad en az 2 karakter olmalı'),
  admin_email: z.string().email('Geçerli bir e-posta adresi girin'),
  admin_password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
})

export async function createTenantAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    brand_color: (formData.get('brand_color') as string) || undefined,
    logo_url: (formData.get('logo_url') as string) || undefined,
    admin_full_name: formData.get('admin_full_name') as string,
    admin_email: formData.get('admin_email') as string,
    admin_password: formData.get('admin_password') as string,
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

  // 1. Tenant oluştur
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      brand_color: parsed.data.brand_color || null,
      logo_url: parsed.data.logo_url || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (tenantError || !tenantData) return { error: 'Tenant oluşturulamadı: ' + tenantError?.message }

  // 2. Admin kullanıcı oluştur (Auth)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.admin_email,
    password: parsed.data.admin_password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.admin_full_name,
      role: 'tenant_admin',
      tenant_id: tenantData.id,
    },
  })

  if (authError || !authData.user) {
    // Tenant oluşmuş ama admin oluşmadıysa, tenant'ı sil
    await supabase.from('tenants').delete().eq('id', tenantData.id)
    return { error: 'Admin kullanıcı oluşturulamadı: ' + authError?.message }
  }

  // 3. Profile (users tablosu) güncelle (otomatik oluşmuş olabilir)
  const { error: profileError } = await supabase.from('users').upsert({
    id: authData.user.id,
    email: parsed.data.admin_email,
    full_name: parsed.data.admin_full_name,
    role: 'tenant_admin',
    tenant_id: tenantData.id,
    is_active: true,
  })

  if (profileError) {
    // Rollback: Auth user'ı sil, tenant'ı sil
    await supabase.auth.admin.deleteUser(authData.user.id)
    await supabase.from('tenants').delete().eq('id', tenantData.id)
    return { error: 'Profil oluşturulamadı: ' + profileError.message }
  }

  revalidatePath('/admin/tenants')
  return { success: 'Tenant ve admin başarıyla oluşturuldu.' }
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
