'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const UpdateDimensionSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  description: z.string().optional(),
  score_1_label: z.string().min(1),
  score_2_label: z.string().min(1),
  score_3_label: z.string().min(1),
  score_4_label: z.string().min(1),
  score_5_label: z.string().min(1),
  weight: z.coerce.number().min(0).max(1).default(1),
})

export async function getRubricTemplatesWithDimensions() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rubric_templates')
    .select(`
      *,
      rubric_dimensions (*)
    `)
    .order('created_at', { ascending: true })

  if (error) return []
  return data
}

export async function updateRubricDimensionAction(dimensionId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string | undefined,
    score_1_label: formData.get('score_1_label') as string,
    score_2_label: formData.get('score_2_label') as string,
    score_3_label: formData.get('score_3_label') as string,
    score_4_label: formData.get('score_4_label') as string,
    score_5_label: formData.get('score_5_label') as string,
    weight: formData.get('weight'),
  }

  const parsed = UpdateDimensionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('rubric_dimensions')
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      score_labels: {
        1: parsed.data.score_1_label,
        2: parsed.data.score_2_label,
        3: parsed.data.score_3_label,
        4: parsed.data.score_4_label,
        5: parsed.data.score_5_label,
      },
      weight: parsed.data.weight,
    })
    .eq('id', dimensionId)

  if (error) return { error: 'Boyut güncellenemedi.' }

  revalidatePath('/admin/rubrics')
  return { success: 'Boyut başarıyla güncellendi.' }
}

export async function toggleDimensionActiveAction(dimensionId: string, isActive: boolean) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') {
    return { error: 'Yetkiniz yok.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('rubric_dimensions')
    .update({ is_active: !isActive })
    .eq('id', dimensionId)

  if (error) return { error: 'Durum güncellenemedi.' }

  revalidatePath('/admin/rubrics')
  return { success: `Boyut ${!isActive ? 'aktifleştirildi' : 'pasifleştirildi'}.` }
}
