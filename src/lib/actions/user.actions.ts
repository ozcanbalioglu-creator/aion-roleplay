'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import type { UserRole } from '@/types'

const InviteUserSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  full_name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  role: z.enum(['tenant_admin', 'hr_admin', 'manager', 'user'] as const),
})

export async function inviteUserAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    email: formData.get('email') as string,
    full_name: formData.get('full_name') as string,
    role: formData.get('role') as string,
  }

  const parsed = InviteUserSchema.safeParse(raw)
  if (!parsed.success) {
    const errors = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
    return { error: errors || 'Geçersiz girdi' }
  }

  const supabase = await createServiceClient()

  // Geçici şifre oluştur (kullanıcı ilk girişte değiştirir)
  const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!'

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      tenant_id: user.tenant_id,
    },
  })

  if (authError || !authData.user) return { error: 'Kullanıcı oluşturulamadı: ' + authError?.message }

  // Trigger tarafından otomatik profile oluşturuluyor, sadece güncelle
  const { error: profileError } = await supabase.from('users').update({
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    is_active: true,
  }).eq('id', authData.user.id)

  if (profileError) return { error: 'Kullanıcı profili güncellenemedi: ' + profileError.message }

  revalidatePath('/tenant/users')
  return {
    success: `${parsed.data.email} başarıyla oluşturuldu.`,
    tempPassword
  }
}

export async function updateUserRoleAction(userId: string, role: UserRole) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)
    .eq('tenant_id', user.tenant_id)

  if (error) return { error: 'Rol güncellenemedi.' }

  revalidatePath('/tenant/users')
  return { success: 'Kullanıcı rolü güncellendi.' }
}

export async function toggleUserStatusAction(userId: string, isActive: boolean) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ is_active: !isActive })
    .eq('id', userId)
    .eq('tenant_id', user.tenant_id)

  if (error) return { error: 'Durum güncellenemedi.' }

  revalidatePath('/tenant/users')
  return { success: `Kullanıcı ${!isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.` }
}

export async function getTenantUsers() {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}
