'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/modules/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const CreateTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  adminEmail: z.string().email(),
  adminName: z.string().min(2),
  plan: z.enum(['starter', 'growth', 'enterprise']).default('starter'),
  maxUsers: z.coerce.number().int().min(1).max(10000).default(50),
})

export async function createTenantAction(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') {
    return { error: 'Yetkisiz erişim' }
  }

  const parsed = CreateTenantSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { name, slug, adminEmail, adminName, plan, maxUsers } = parsed.data
  const supabase = await createClient()

  // Slug unique kontrolü
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    return { error: 'Bu slug zaten kullanılıyor' }
  }

  // Tenant oluştur
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name, slug, plan, max_users: maxUsers })
    .select()
    .single()

  if (tenantError || !tenant) {
    return { error: 'Tenant oluşturulamadı' }
  }

  // Admin kullanıcıyı Supabase Auth'a ekle (service role gerektirir)
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    email_confirm: true,
    user_metadata: {
      full_name: adminName,
      role: 'tenant_admin',
      tenant_id: tenant.id,
    },
  })

  if (authError || !authUser.user) {
    // Tenant'ı geri al
    await supabase.from('tenants').delete().eq('id', tenant.id)
    return { error: `Kullanıcı oluşturulamadı: ${authError?.message}` }
  }

  // Şifre sıfırlama e-postası gönder
  await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: adminEmail,
  })

  revalidatePath('/admin/tenants')
  return { success: true, tenantId: tenant.id }
}

export async function toggleTenantStatusAction(tenantId: string, isActive: boolean) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') {
    return { error: 'Yetkisiz erişim' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update({ is_active: isActive })
    .eq('id', tenantId)

  if (error) return { error: error.message }

  revalidatePath('/admin/tenants')
  return { success: true }
}