'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { syncUserRoleToJwt } from '@/lib/auth/role-sync'
import type { UserRole } from '@/types'

const InviteUserSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  full_name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  role: z.enum(['tenant_admin', 'hr_admin', 'hr_viewer', 'manager', 'user'] as const),
  title: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalı').regex(/^[a-z0-9_.-]+$/, 'Sadece küçük harf, rakam, nokta, tire ve alt çizgi').optional().or(z.literal('')),
  manager_id: z.string().uuid().optional().or(z.literal('')),
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
    title: (formData.get('title') as string) || undefined,
    position: (formData.get('position') as string) || undefined,
    department: (formData.get('department') as string) || undefined,
    username: (formData.get('username') as string) || undefined,
    manager_id: (formData.get('manager_id') as string) || undefined,
  }

  const parsed = InviteUserSchema.safeParse(raw)
  if (!parsed.success) {
    const errors = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
    return { error: errors || 'Geçersiz girdi' }
  }

  const supabase = await createServiceClient()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
        tenant_id: user.tenant_id,
      },
      redirectTo: `${appUrl}/auth/callback`,
    }
  )

  if (authError || !authData.user) {
    const isExists = authError?.message?.includes('already been registered') || authError?.message?.includes('already registered')
    if (isExists) return { error: 'Bu e-posta zaten kayıtlı.' }
    return { error: 'Davet gönderilemedi: ' + authError?.message }
  }

  // user_metadata.role createUser çağrısında zaten set edildi.
  // syncUserRoleToJwt burada idempotent — metadata'yı tekrar yazar ve audit log kaydeder.
  await syncUserRoleToJwt(authData.user.id, parsed.data.role as UserRole, user.id, user.email, user.tenant_id)

  // Trigger tarafından otomatik profile oluşturuluyor, sadece güncelle
  const updateData: Record<string, unknown> = {
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    is_active: true,
  }
  if (parsed.data.title) updateData.title = parsed.data.title
  if (parsed.data.position) updateData.position = parsed.data.position
  if (parsed.data.department) updateData.department = parsed.data.department
  if (parsed.data.username) updateData.username = parsed.data.username
  if (parsed.data.manager_id) updateData.manager_id = parsed.data.manager_id

  const { error: profileError } = await supabase.from('users').update(updateData).eq('id', authData.user.id)

  if (profileError) return { error: 'Kullanıcı profili güncellenemedi: ' + profileError.message }

  revalidatePath('/tenant/users')
  return { success: `${parsed.data.email} adresine davet gönderildi.` }
}

export async function updateUserRoleAction(userId: string, role: UserRole) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = createServiceClient()

  // 1. users.role güncelle
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)
    .eq('tenant_id', user.tenant_id)
  if (error) return { error: 'Rol güncellenemedi.' }

  // 2. JWT user_metadata.role güncelle + audit log yaz
  const syncResult = await syncUserRoleToJwt(userId, role, user.id, user.email, user.tenant_id)
  if (syncResult.error) return { error: syncResult.error }

  // 3. Kullanıcının diğer aktif oturumlarını kapat (CLAUDE.md: Confirmed Product Decisions)
  // Not: supabase.auth.admin.signOut() ilk parametre olarak JWT string bekliyor, UUID değil.
  // Bu nedenle Supabase REST Admin API'yi doğrudan fetch ile çağırıyoruz.
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceRoleKey) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: 'global' }),
      })
    }
  } catch {
    // Force sign-out hatası kritik değil — rol güncellendi, audit log yazıldı.
  }

  revalidatePath('/tenant/users')
  return { success: 'Kullanıcı rolü güncellendi.' }
}

export async function updateUserManagerAction(userId: string, managerId: string | null) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createClient()

  if (managerId) {
    const { data: manager } = await supabase
      .from('users')
      .select('id')
      .eq('id', managerId)
      .eq('tenant_id', user.tenant_id)
      .eq('role', 'manager')
      .maybeSingle()

    if (!manager) return { error: 'Geçerli bir yönetici seçin.' }
  }

  const { error } = await supabase
    .from('users')
    .update({ manager_id: managerId })
    .eq('id', userId)
    .eq('tenant_id', user.tenant_id)

  if (error) return { error: 'Yönetici güncellenemedi.' }

  revalidatePath('/tenant/users')
  return { success: 'Yönetici ataması güncellendi.' }
}

export async function toggleUserStatusAction(userId: string, isActive: boolean) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('users')
    .update({ is_active: !isActive })
    .eq('id', userId)
    .eq('tenant_id', user.tenant_id)

  if (error) return { error: 'Durum güncellenemedi.' }

  revalidatePath('/tenant/users')
  return { success: `Kullanıcı ${!isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.` }
}

export async function updateUserProfileAction(
  userId: string,
  data: { full_name?: string; title?: string; position?: string; department?: string; username?: string }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['super_admin', 'tenant_admin'].includes(currentUser.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('users')
    .update(data)
    .eq('id', userId)
    .eq('tenant_id', currentUser.tenant_id)

  if (error) return { error: 'Kullanıcı güncellenemedi.' }

  revalidatePath('/tenant/users')
  return { success: 'Kullanıcı güncellendi.' }
}

export async function deleteUserAction(userId: string) {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createServiceClient()

  // Önce aynı tenant'a ait olduğunu doğrula
  const { data: target } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('id', userId)
    .eq('tenant_id', user.tenant_id)
    .maybeSingle()

  if (!target) return { error: 'Kullanıcı bulunamadı.' }

  const { error: authError } = await supabase.auth.admin.deleteUser(userId)
  if (authError) return { error: 'Kullanıcı silinemedi: ' + authError.message }

  revalidatePath('/tenant/users')
  return { success: 'Kullanıcı silindi.' }
}

export async function updateMyProfileAction(
  data: { full_name?: string; title?: string; position?: string; department?: string }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Oturum açılı değil.' }

  // SSR client (cookie tabanlı) kullanılır — auth.uid() RLS'te doğru çalışsın.
  // Service role key eksikliğinden bağımsız olur, role/tenant_id değiştirilemez.
  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update(data)
    .eq('id', currentUser.id)

  if (error) return { error: 'Profil güncellenemedi.' }

  revalidatePath('/dashboard/profile')
  return { success: 'Profil güncellendi.' }
}

export async function uploadAvatarAction(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'Oturum açılı değil.' }

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) return { error: 'Dosya seçilmedi.' }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext ?? '')) {
    return { error: 'Desteklenmeyen dosya formatı. JPG, PNG veya WebP yükleyin.' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Dosya boyutu 5MB\'ı geçemez.' }
  }

  const supabase = await createServiceClient()

  const filePath = `${currentUser.id}/avatar.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) return { error: 'Fotoğraf yüklenemedi: ' + uploadError.message }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
  const publicUrl = urlData.publicUrl + `?t=${Date.now()}`

  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', currentUser.id)

  if (updateError) return { error: 'Fotoğraf URL kaydedilemedi.' }

  revalidatePath('/dashboard/profile')
  return { success: 'Fotoğraf güncellendi.', avatarUrl: publicUrl }
}

export async function getTenantUsers() {
  const user = await getCurrentUser()
  if (!user || !['super_admin', 'tenant_admin', 'hr_admin', 'manager'].includes(user.role)) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}
