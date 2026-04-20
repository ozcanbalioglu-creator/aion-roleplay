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

  const { data: authData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
        tenant_id: user.tenant_id,
      },
    }
  )

  if (inviteError) return { error: 'Davet gönderilemedi: ' + inviteError.message }

  const { error: profileError } = await supabase.from('users').upsert({
    id: authData.user.id,
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    tenant_id: user.tenant_id,
    is_active: true,
  })

  if (profileError) return { error: 'Kullanıcı profili oluşturulamadı: ' + profileError.message }

  revalidatePath('/tenant/users')
  return { success: `${parsed.data.email} adresine davet gönderildi.` }
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
