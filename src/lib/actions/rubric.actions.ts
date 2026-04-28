'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const STANDARD_DIMENSIONS = [
  {
    dimension_code: 'active_listening', name: 'Aktif Dinleme', is_required: true, sort_order: 1,
    score_labels: { '1': 'Neredeyse hiç dinlemiyor, sözü kesiyor', '2': 'Kısmen dinliyor', '3': 'Çoğunlukla dinliyor', '4': 'Aktif dinliyor, yansıtıyor', '5': 'Derin dinleme, sözsüz sinyalleri de yakalar' },
  },
  {
    dimension_code: 'powerful_questions', name: 'Güçlü Sorular', is_required: true, sort_order: 2,
    score_labels: { '1': 'Kapalı veya yönlendirici sorular', '2': 'Bazı açık sorular var', '3': 'Düzenli açık sorular soruyor', '4': 'Derinleştiren, farkındalık yaratan sorular', '5': 'Dönüştürücü sorular, yeni perspektif açıyor' },
  },
  {
    dimension_code: 'summarizing', name: 'Özetleme', is_required: true, sort_order: 3,
    score_labels: { '1': 'Hiç özetleme yok', '2': 'Nadir özetliyor', '3': 'Ara sıra özetliyor', '4': 'Düzenli ve doğru özetliyor', '5': 'Özetleme ile derinleştiriyor, kişinin kendini duyulmuş hissettiriyor' },
  },
  {
    dimension_code: 'empathy', name: 'Empati', is_required: true, sort_order: 4,
    score_labels: { '1': 'Duygusal içeriği görmezden geliyor', '2': 'Yüzeysel onaylama', '3': 'Duyguları fark ediyor ve isimlendiriyor', '4': 'Güçlü empati, perspektif alıyor', '5': 'Empati derin güven ortamı yaratıyor' },
  },
  {
    dimension_code: 'action_clarity', name: 'Eylem Netliği', is_required: true, sort_order: 5,
    score_labels: { '1': 'Görüşme belirsiz bitiyor, adım yok', '2': 'Belirsiz niyet var', '3': 'Genel bir eylem belirlenmiş', '4': 'Somut, ölçülebilir adımlar var', '5': 'SMART plan, sorumluluk ve takip neti' },
  },
  {
    dimension_code: 'non_judgmental', name: 'Yargısız Yaklaşım', is_required: true, sort_order: 6,
    score_labels: { '1': 'Açık yargılama veya eleştiri var', '2': 'İnce yargılayıcı mesajlar', '3': 'Genellikle tarafsız', '4': 'Tutarlı yargısız dil', '5': 'Tamamen kabullenici, güvenli alan yaratıyor' },
  },
  {
    dimension_code: 'assumption_challenging', name: 'Varsayım Sorgulama', is_required: false, sort_order: 7,
    score_labels: { '1': 'Varsayımları hiç sorgulamıyor', '2': 'Nadir sorgulama', '3': 'Bazı varsayımları gösteriyor', '4': 'Kısıtlayıcı inançları ustalıkla sorgular', '5': 'Derin inanç sistemi dönüşümüne kapı açıyor' },
  },
  {
    dimension_code: 'responsibility_opening', name: 'Sorumluluk Açma', is_required: false, sort_order: 8,
    score_labels: { '1': 'Sorumluluk hiç ele alınmıyor', '2': 'Zayıf sorumluluk çerçevesi', '3': 'Sorumluluk konuşuluyor', '4': 'Kişi kendi payını açıkça görüyor', '5': 'İçten gelen sorumluluk ve eylem isteği oluşuyor' },
  },
  {
    dimension_code: 'goal_alignment', name: 'Hedef Hizalama', is_required: false, sort_order: 9,
    score_labels: { '1': 'Hedefler belirsiz veya yok', '2': 'Yüzeysel hedef var', '3': 'Genel hedef netleşti', '4': 'Anlamlı ve kişisel hedef hizalandı', '5': 'Hedef derin motivasyonla bağlandı' },
  },
  {
    dimension_code: 'feedback_quality', name: 'Geri Bildirim Kalitesi', is_required: false, sort_order: 10,
    score_labels: { '1': 'Geri bildirim yok ya da zararlı', '2': 'Belirsiz geri bildirim', '3': 'Davranış odaklı geri bildirim', '4': 'Somut, gelişim odaklı, zamanlı', '5': 'Ustaca verilmiş, içselleştirilmiş geri bildirim' },
  },
  {
    dimension_code: 'silence_management', name: 'Sessizlik Yönetimi', is_required: false, sort_order: 11,
    score_labels: { '1': 'Sessizliği hemen dolduruyor', '2': 'Kısa sessizliğe tolerans', '3': 'Sessizliği zaman zaman kullanıyor', '4': 'Sessizliği bilinçli kullanıyor', '5': 'Sessizlik dönüşüm aracı olarak kullanılıyor' },
  },
  {
    dimension_code: 'reframing', name: 'Yeniden Çerçeveleme', is_required: false, sort_order: 12,
    score_labels: { '1': 'Yeniden çerçeveleme yok', '2': 'Zayıf çerçeve değişikliği denemesi', '3': 'Bir durumu farklı gösteriyor', '4': 'Etkili reframing, yeni perspektif açıyor', '5': 'Dönüştürücü reframing, köklü bakış açısı değişimi' },
  },
]

const CreateTemplateSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalı').max(100),
  description: z.string().max(300).optional(),
  is_default: z.coerce.boolean().default(false),
})

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

export async function createRubricTemplateAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return { error: 'Yetkiniz yok.' }

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    is_default: formData.get('is_default') === 'true',
  }

  const parsed = CreateTemplateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  const { data: template, error: templateError } = await supabase
    .from('rubric_templates')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      is_default: parsed.data.is_default,
      is_active: true,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (templateError || !template) return { error: 'Template oluşturulamadı.' }

  const dimensions = STANDARD_DIMENSIONS.map((d) => ({
    template_id: template.id,
    dimension_code: d.dimension_code,
    name: d.name,
    is_required: d.is_required,
    sort_order: d.sort_order,
    score_labels: d.score_labels,
    weight: 1.0,
    is_active: true,
  }))

  const { error: dimError } = await supabase.from('rubric_dimensions').insert(dimensions)
  if (dimError) return { error: 'Boyutlar oluşturulamadı: ' + dimError.message }

  revalidatePath('/admin/rubrics')
  return { success: 'Template başarıyla oluşturuldu.' }
}

export async function getRubricTemplatesForSelect() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('rubric_templates')
    .select('id, name, is_default')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return data ?? []
}

export async function getRubricTemplateList() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rubric_templates')
    .select(`
      id, name, description, is_default, is_active, created_at,
      rubric_dimensions(id, is_active),
      tenants!tenants_rubric_template_id_fkey(id, name)
    `)
    .order('created_at', { ascending: true })

  if (error) return []

  return data.map((t) => {
    const dims = t.rubric_dimensions as { id: string; is_active: boolean }[]
    const tenants = t.tenants as { id: string; name: string }[]
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      is_default: t.is_default,
      is_active: t.is_active,
      created_at: t.created_at,
      total_dimensions: dims.length,
      active_dimensions: dims.filter((d) => d.is_active).length,
      tenant_count: tenants.length,
      tenant_names: tenants.map((tn) => tn.name),
    }
  })
}

export async function getRubricTemplateWithDimensions(templateId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rubric_templates')
    .select(`*, rubric_dimensions(*)`)
    .eq('id', templateId)
    .single()

  if (error) return null
  return data
}

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
    description: (formData.get('description') as string | null) ?? undefined,
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

export async function getTenantsForRubricAssignment(templateId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return { assigned: [], unassigned: [] }

  const supabase = await createClient()
  const { data: allTenants } = await supabase
    .from('tenants')
    .select('id, name, rubric_template_id')
    .eq('is_active', true)
    .order('name')

  if (!allTenants) return { assigned: [], unassigned: [] }

  const assigned = allTenants.filter((t) => t.rubric_template_id === templateId)
  const unassigned = allTenants.filter((t) => t.rubric_template_id !== templateId)
  return { assigned, unassigned }
}

export async function assignRubricToTenantAction(templateId: string, tenantId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return { error: 'Yetkiniz yok.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update({ rubric_template_id: templateId })
    .eq('id', tenantId)

  if (error) return { error: 'Atama başarısız.' }

  revalidatePath('/admin/rubrics')
  revalidatePath('/admin/tenants')
  return { success: 'Rubric atandı.' }
}

export async function unassignRubricFromTenantAction(tenantId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return { error: 'Yetkiniz yok.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update({ rubric_template_id: null })
    .eq('id', tenantId)

  if (error) return { error: 'Kaldırma başarısız.' }

  revalidatePath('/admin/rubrics')
  revalidatePath('/admin/tenants')
  return { success: 'Rubric kaldırıldı.' }
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
