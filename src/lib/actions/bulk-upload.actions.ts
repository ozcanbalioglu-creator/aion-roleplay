'use server'

import * as XLSX from 'xlsx'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export interface BulkUploadRow {
  row: number
  email: string
  full_name: string
  status: 'created' | 'skipped' | 'error'
  message?: string
}

export interface BulkUploadResult {
  created: number
  skipped: number
  errors: number
  rows: BulkUploadRow[]
}

const ROLE_MAP: Record<string, string> = {
  'kullanıcı': 'user',
  'user': 'user',
  'yönetici': 'manager',
  'manager': 'manager',
  'ik admin': 'hr_admin',
  'hr admin': 'hr_admin',
  'hr_admin': 'hr_admin',
  'ik görüntüleyici': 'hr_viewer',
  'hr görüntüleyici': 'hr_viewer',
  'hr_viewer': 'hr_viewer',
  'kurum admin': 'tenant_admin',
  'tenant admin': 'tenant_admin',
  'tenant_admin': 'tenant_admin',
}

const MAX_ROWS = 200

export async function bulkUploadUsersAction(
  formData: FormData
): Promise<BulkUploadResult | { error: string }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['super_admin', 'tenant_admin'].includes(currentUser.role)) {
    return { error: 'Yetkiniz yok.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Dosya seçilmedi.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', codepage: 65001 })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)

  if (!rows || rows.length === 0) {
    return { error: 'Dosya boş veya okunamadı.' }
  }

  if (rows.length > MAX_ROWS) {
    return { error: 'En fazla 200 satır yüklenebilir.' }
  }

  const supabase = createServiceClient()
  const results: BulkUploadRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const email = raw['E-posta']?.trim().toLowerCase()
    const full_name = raw['Ad Soyad']?.trim()
    const roleTr = raw['Rol']?.trim()
    const department = raw['Departman']?.trim() || undefined

    if (!email || !full_name || !roleTr) {
      results.push({
        row: i + 2,
        email: email ?? '',
        full_name: full_name ?? '',
        status: 'error',
        message: 'Zorunlu alan eksik',
      })
      continue
    }

    const role = ROLE_MAP[roleTr.toLocaleLowerCase('tr-TR')]
    if (!role) {
      results.push({
        row: i + 2,
        email,
        full_name,
        status: 'error',
        message: `Geçersiz rol: ${roleTr}`,
      })
      continue
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name, role, tenant_id: currentUser.tenant_id },
        redirectTo: `${appUrl}/auth/callback`,
      }
    )

    if (authError) {
      const isEmailExists =
        authError.message?.includes('already been registered') ||
        authError.message?.includes('already registered') ||
        (authError as { code?: string }).code === 'email_exists'

      if (isEmailExists) {
        results.push({
          row: i + 2,
          email,
          full_name,
          status: 'skipped',
          message: 'Kullanıcı zaten mevcut',
        })
      } else {
        results.push({
          row: i + 2,
          email,
          full_name,
          status: 'error',
          message: authError.message,
        })
      }
      continue
    }

    await supabase
      .from('users')
      .update({
        full_name,
        role,
        department: department ?? null,
        is_active: true,
      })
      .eq('id', authData.user.id)

    results.push({ row: i + 2, email, full_name, status: 'created' })
  }

  revalidatePath('/tenant/users')

  return {
    created: results.filter(r => r.status === 'created').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results.filter(r => r.status === 'error').length,
    rows: results,
  }
}
