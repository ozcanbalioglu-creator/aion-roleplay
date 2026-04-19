'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const UpdatePromptSchema = z.object({
  content: z.string().min(10),
  change_summary: z.string().optional(),
})

export async function getPromptTemplates() {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') return []

  const supabase = await createServerClient()
  const { data } = await supabase
    .from('prompt_templates')
    .select(`
      *,
      prompt_versions(
        id, version_number, is_active, created_at, change_summary,
        created_by
      )
    `)
    .order('prompt_type')

  return data ?? []
}

export async function getActivePromptContent(templateId: string): Promise<string | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('prompt_versions')
    .select('content')
    .eq('template_id', templateId)
    .eq('is_active', true)
    .single()

  return data?.content ?? null
}

export async function updatePromptVersionAction(templateId: string, formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') {
    return { error: 'Yetkisiz erişim' }
  }

  const parsed = UpdatePromptSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { content, change_summary } = parsed.data
  const supabase = await createServerClient()

  // Mevcut aktif versiyonu bul
  const { data: current } = await supabase
    .from('prompt_versions')
    .select('id, version_number, content')
    .eq('template_id', templateId)
    .eq('is_active', true)
    .single()

  // İçerik değişmemişse kaydetme
  if (current?.content === content) {
    return { error: 'İçerik değişmemiş' }
  }

  // Eski versiyonu pasife al
  await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('template_id', templateId)
    .eq('is_active', true)

  // Yeni versiyon oluştur
  const { error: insertError } = await supabase
    .from('prompt_versions')
    .insert({
      template_id: templateId,
      content,
      version_number: (current?.version_number ?? 0) + 1,
      is_active: true,
      change_summary: change_summary || null,
      created_by: currentUser.id,
    })

  if (insertError) return { error: insertError.message }

  revalidatePath('/admin/prompts')
  return { success: true }
}

export async function rollbackPromptVersionAction(versionId: string, templateId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'super_admin') {
    return { error: 'Yetkisiz erişim' }
  }

  const supabase = await createServerClient()

  // Rollback yapılacak versiyonun içeriğini al
  const { data: targetVersion } = await supabase
    .from('prompt_versions')
    .select('content, version_number')
    .eq('id', versionId)
    .single()

  if (!targetVersion) return { error: 'Versiyon bulunamadı' }

  // Mevcut aktifi pasife al
  await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('template_id', templateId)
    .eq('is_active', true)

  // En yüksek version_number'ı bul
  const { data: maxVersion } = await supabase
    .from('prompt_versions')
    .select('version_number')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  // Yeni versiyon olarak rollback içeriğini kaydet
  await supabase.from('prompt_versions').insert({
    template_id: templateId,
    content: targetVersion.content,
    version_number: (maxVersion?.version_number ?? 0) + 1,
    is_active: true,
    change_summary: `v${targetVersion.version_number}'e rollback`,
    created_by: currentUser.id,
  })

  revalidatePath('/admin/prompts')
  return { success: true }
}
