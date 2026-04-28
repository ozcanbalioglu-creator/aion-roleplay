'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import type { TenantContextProfile } from '@/types'

const CreateTenantSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug sadece küçük harf, rakam ve tire içerebilir'),
  brand_color: z.string().optional(),
  website_url: z.string().url('Geçerli bir web adresi girin').or(z.literal('')).optional(),
  admin_full_name: z.string().min(2, 'Ad-soyad en az 2 karakter olmalı'),
  admin_email: z.string().email('Geçerli bir e-posta adresi girin'),
  admin_position: z.string().optional(),
  admin_password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
  rubric_template_id: z.string().uuid().or(z.literal('')).optional(),
})

const UpdateTenantSchema = z.object({
  id: z.string().uuid('Geçersiz tenant id'),
  name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug sadece küçük harf, rakam ve tire içerebilir'),
  brand_color: z.string().optional(),
  website_url: z.string().url('Geçerli bir web adresi girin').or(z.literal('')).optional(),
  existing_logo_url: z.string().url().or(z.literal('')).optional(),
  admin_user_id: z.string().uuid().or(z.literal('')).optional(),
  admin_full_name: z.string().min(2, 'Admin adı-soyadı en az 2 karakter olmalı'),
  admin_email: z.string().email('Geçerli bir admin e-posta adresi girin'),
  admin_position: z.string().optional(),
  admin_password: z.string().min(8, 'Şifre en az 8 karakter olmalı').or(z.literal('')).optional(),
  rubric_template_id: z.string().uuid().or(z.literal('')).optional(),
})

async function uploadTenantLogo(file: File | null, slug: string) {
  if (!file || file.size === 0) return null

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Logo için sadece JPG, PNG, WebP veya SVG dosyası yüklenebilir.')
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Logo dosyası 2MB sınırını aşamaz.')
  }

  const supabase = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((bucket) => bucket.id === 'tenants')) {
    await supabase.storage.createBucket('tenants', { public: true })
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const filePath = `logos/${slug}-${Date.now()}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage.from('tenants').upload(filePath, buffer, {
    contentType: file.type,
    upsert: true,
  })

  if (error) {
    throw new Error(`Logo yüklenemedi: ${error.message}`)
  }

  const { data: { publicUrl } } = supabase.storage.from('tenants').getPublicUrl(filePath)
  return publicUrl
}

export async function createTenantAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    brand_color: (formData.get('brand_color') as string) || undefined,
    website_url: (formData.get('website_url') as string) || undefined,
    admin_full_name: formData.get('admin_full_name') as string,
    admin_email: formData.get('admin_email') as string,
    admin_position: (formData.get('admin_position') as string) || undefined,
    admin_password: formData.get('admin_password') as string,
    rubric_template_id: (formData.get('rubric_template_id') as string) || undefined,
  }

  const parsed = CreateTenantSchema.safeParse(raw)
  if (!parsed.success) {
    const errors = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
    console.error('Validation errors:', errors, 'Raw data:', raw)
    return { error: errors || 'Geçersiz girdi' }
  }

  const supabase = await createServiceClient()
  let logoUrl: string | null = null

  try {
    logoUrl = await uploadTenantLogo(formData.get('logo_file') as File | null, parsed.data.slug)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Logo yüklenemedi.' }
  }

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
      website_url: parsed.data.website_url || null,
      logo_url: logoUrl,
      is_active: true,
      rubric_template_id: parsed.data.rubric_template_id || null,
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

  // 3. Profile'ı güncelle (trigger tarafından otomatik oluşturuluyor)
  const { error: profileError } = await supabase.from('users').update({
    email: parsed.data.admin_email,
    full_name: parsed.data.admin_full_name,
    position: parsed.data.admin_position || null,
    is_active: true,
  }).eq('id', authData.user.id)

  if (profileError) {
    // Rollback: Auth user'ı sil, tenant'ı sil
    await supabase.auth.admin.deleteUser(authData.user.id)
    await supabase.from('tenants').delete().eq('id', tenantData.id)
    return { error: 'Profil oluşturulamadı: ' + profileError.message }
  }

  revalidatePath('/admin/tenants')
  return { success: 'Tenant ve admin başarıyla oluşturuldu.' }
}

export async function updateTenantAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    id: formData.get('id') as string,
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    brand_color: (formData.get('brand_color') as string) || undefined,
    website_url: (formData.get('website_url') as string) || undefined,
    existing_logo_url: (formData.get('existing_logo_url') as string) || undefined,
    admin_user_id: (formData.get('admin_user_id') as string) || undefined,
    admin_full_name: formData.get('admin_full_name') as string,
    admin_email: formData.get('admin_email') as string,
    admin_position: (formData.get('admin_position') as string) || undefined,
    admin_password: (formData.get('admin_password') as string) || undefined,
    rubric_template_id: (formData.get('rubric_template_id') as string) || undefined,
  }

  const parsed = UpdateTenantSchema.safeParse(raw)
  if (!parsed.success) {
    const errors = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
    return { error: errors || 'Geçersiz girdi' }
  }

  const supabase = await createServiceClient()

  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', parsed.data.slug)
    .neq('id', parsed.data.id)
    .maybeSingle()

  if (existing) return { error: 'Bu slug başka bir tenant tarafından kullanılıyor.' }

  let logoUrl = parsed.data.existing_logo_url || null
  try {
    const uploadedLogo = await uploadTenantLogo(formData.get('logo_file') as File | null, parsed.data.slug)
    if (uploadedLogo) logoUrl = uploadedLogo
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Logo yüklenemedi.' }
  }

  const { error } = await supabase
    .from('tenants')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      brand_color: parsed.data.brand_color || null,
      website_url: parsed.data.website_url || null,
      logo_url: logoUrl,
      rubric_template_id: parsed.data.rubric_template_id || null,
    })
    .eq('id', parsed.data.id)

  if (error) return { error: 'Tenant güncellenemedi: ' + error.message }

  const adminPassword = parsed.data.admin_password || undefined
  const adminUpdateData = {
    email: parsed.data.admin_email,
    user_metadata: {
      full_name: parsed.data.admin_full_name,
      role: 'tenant_admin',
      tenant_id: parsed.data.id,
    },
    ...(adminPassword ? { password: adminPassword } : {}),
  }

  const adminUserId = parsed.data.admin_user_id || null

  if (adminUserId) {
    const { error: authError } = await supabase.auth.admin.updateUserById(adminUserId, adminUpdateData)
    if (authError) return { error: 'Tenant admin auth bilgileri güncellenemedi: ' + authError.message }

    const { error: profileError } = await supabase
      .from('users')
      .update({
        email: parsed.data.admin_email,
        full_name: parsed.data.admin_full_name,
        position: parsed.data.admin_position || null,
        is_active: true,
      })
      .eq('id', adminUserId)
      .eq('tenant_id', parsed.data.id)

    if (profileError) return { error: 'Tenant admin profili güncellenemedi: ' + profileError.message }
  } else {
    if (!adminPassword) {
      return { error: 'Bu tenant için admin oluşturmak üzere şifre girmeniz gerekiyor.' }
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: parsed.data.admin_email,
      password: adminPassword,
      email_confirm: true,
      user_metadata: adminUpdateData.user_metadata,
    })

    if (authError || !authData.user) {
      return { error: 'Tenant admin oluşturulamadı: ' + authError?.message }
    }

    const { error: profileError } = await supabase
      .from('users')
      .update({
        email: parsed.data.admin_email,
        full_name: parsed.data.admin_full_name,
        position: parsed.data.admin_position || null,
        role: 'tenant_admin',
        is_active: true,
      })
      .eq('id', authData.user.id)

    if (profileError) return { error: 'Tenant admin profili oluşturulamadı: ' + profileError.message }
  }

  revalidatePath('/admin/tenants')
  return { success: 'Tenant bilgileri güncellendi.' }
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

const TenantContextSchema = z.object({
  company_description: z.string().max(1000).optional(),
  industry: z.string().max(100).optional(),
  product_summary: z.string().max(500).optional(),
  company_size: z.string().max(100).optional(),
  culture_notes: z.string().max(500).optional(),
})

export async function updateTenantContextAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const raw: TenantContextProfile = {
    company_description: (formData.get('company_description') as string) || undefined,
    industry: (formData.get('industry') as string) || undefined,
    product_summary: (formData.get('product_summary') as string) || undefined,
    company_size: (formData.get('company_size') as string) || undefined,
    culture_notes: (formData.get('culture_notes') as string) || undefined,
  }

  const parsed = TenantContextSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const tenantId = user.role === 'super_admin'
    ? (formData.get('tenant_id') as string)
    : user.tenant_id

  if (!tenantId) return { error: 'Tenant bulunamadı.' }

  // Service client: tenants tablosunda tenant_admin için UPDATE RLS policy yok,
  // yetki kontrolü action başında yapıldığı için service role güvenli.
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('tenants')
    .update({ context_profile: parsed.data })
    .eq('id', tenantId)

  if (error) return { error: 'Kurum profili güncellenemedi: ' + error.message }

  revalidatePath('/tenant/settings')
  revalidatePath('/admin/tenants')
  return { success: 'Kurum profili güncellendi.' }
}

export async function getTenants() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return []

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('*, rubric_templates(id, name)')
    .order('created_at', { ascending: false })

  if (error) return []
  const tenantIds = data.map((tenant) => tenant.id)
  if (!tenantIds.length) return data.map((t) => ({ ...t, admin_user: null }))

  const { data: admins } = await supabase
    .from('users')
    .select('id, tenant_id, full_name, email, position')
    .in('tenant_id', tenantIds)
    .eq('role', 'tenant_admin')
    .order('created_at', { ascending: true })

  const adminMap = new Map<string, NonNullable<typeof admins>[number]>()
  for (const admin of admins ?? []) {
    if (!adminMap.has(admin.tenant_id)) adminMap.set(admin.tenant_id, admin)
  }

  return data.map((tenant) => {
    const { rubric_templates, ...rest } = tenant as typeof tenant & { rubric_templates?: { name: string } | null }
    return {
      ...rest,
      rubric_template_name: rubric_templates?.name ?? null,
      admin_user: adminMap.get(tenant.id) ?? null,
    }
  })
}
