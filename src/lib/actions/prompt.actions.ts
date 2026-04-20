'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const UpdatePromptSchema = z.object({
  content: z.string().min(10, 'Prompt en az 10 karakter olmalı'),
  variables: z.array(z.string()).default([]),
})

export async function getPromptTemplates() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('prompt_templates')
    .select(`
      *,
      prompt_versions (
        id, version_number, content, variables, is_active, created_at, created_by
      )
    `)
    .order('created_at', { ascending: true })

  if (error) return []
  return data
}

export async function updatePromptVersionAction(templateId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    content: formData.get('content') as string,
    variables: JSON.parse((formData.get('variables') as string) || '[]'),
  }

  const parsed = UpdatePromptSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('template_id', templateId)
    .eq('is_active', true)

  const { data: latest } = await supabase
    .from('prompt_versions')
    .select('version_number')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('prompt_versions').insert({
    template_id: templateId,
    version_number: (latest?.version_number ?? 0) + 1,
    content: parsed.data.content,
    variables: parsed.data.variables,
    is_active: true,
    created_by: user.id,
  })

  if (error) return { error: 'Prompt versiyonu kaydedilemedi.' }

  revalidatePath('/admin/prompts')
  return { success: 'Yeni versiyon başarıyla kaydedildi.' }
}

export async function rollbackPromptVersionAction(versionId: string, templateId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createClient()

  await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('template_id', templateId)

  const { error } = await supabase
    .from('prompt_versions')
    .update({ is_active: true })
    .eq('id', versionId)

  if (error) return { error: 'Rollback başarısız.' }

  revalidatePath('/admin/prompts')
  return { success: 'Versiyon geri alındı.' }
}

export async function getPromptVersionHistory(templateId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })

  if (error) return []
  return data
}
