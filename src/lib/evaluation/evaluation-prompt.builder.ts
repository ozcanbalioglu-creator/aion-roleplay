import { createServiceRoleClient } from '@/lib/supabase/server'
import type { NormalizedTranscript } from './transcript.service'
import { formatTranscriptForPrompt } from './transcript.service'

export interface RubricDimensionForEval {
  dimensionCode: string
  dimensionName: string
  description: string
  isRequired: boolean
  level1Desc: string
  level3Desc: string
  level5Desc: string
}

export interface EvaluationPromptData {
  systemPrompt: string
  userPrompt: string
  dimensions: RubricDimensionForEval[]
  expectedJsonSchema: string
}

export async function buildEvaluationPrompt(
  sessionId: string,
  tenantId: string,
  transcript: NormalizedTranscript
): Promise<EvaluationPromptData> {
  const supabase = await createServiceRoleClient()

  // Tenant'ın atanmış template'ini kontrol et
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('rubric_template_id')
    .eq('id', tenantId)
    .single()

  const templateFilter = tenantRow?.rubric_template_id
    ? supabase
        .from('rubric_templates')
        .select(`id, name, rubric_dimensions(dimension_code, dimension_name, description, is_required, level_1_desc, level_3_desc, level_5_desc)`)
        .eq('id', tenantRow.rubric_template_id)
        .eq('is_active', true)
        .single()
    : supabase
        .from('rubric_templates')
        .select(`id, name, rubric_dimensions(dimension_code, dimension_name, description, is_required, level_1_desc, level_3_desc, level_5_desc)`)
        .eq('is_default', true)
        .eq('is_active', true)
        .single()

  const { data: rubricData, error } = await templateFilter

  type RubricRow = { rubric_dimensions: { dimension_code: string; dimension_name: string; description: string; is_required: boolean; level_1_desc: string | null; level_3_desc: string | null; level_5_desc: string | null }[] }
  const typed = rubricData as RubricRow | null

  if (error || !typed?.rubric_dimensions?.length) {
    throw new Error('Aktif rubric bulunamadı')
  }

  const dimensions: RubricDimensionForEval[] = typed.rubric_dimensions.map((d) => ({
    dimensionCode: d.dimension_code,
    dimensionName: d.dimension_name,
    description: d.description,
    isRequired: d.is_required,
    level1Desc: d.level_1_desc ?? 'Yeterli değil',
    level3Desc: d.level_3_desc ?? 'Orta düzey',
    level5Desc: d.level_5_desc ?? 'Mükemmel',
  }))

  // Boyut açıklamaları
  const dimensionList = dimensions
    .map(
      (d, i) =>
        `${i + 1}. **${d.dimensionName}** (kod: ${d.dimensionCode}${d.isRequired ? ', zorunlu' : ', opsiyonel'})\n` +
        `   Açıklama: ${d.description}\n` +
        `   Puan 1: ${d.level1Desc}\n` +
        `   Puan 3: ${d.level3Desc}\n` +
        `   Puan 5: ${d.level5Desc}`
    )
    .join('\n\n')

  // Beklenen JSON şeması
  const expectedJsonSchema = JSON.stringify(
    {
      dimensions: dimensions.map((d) => ({
        dimension_code: d.dimensionCode,
        score: '1-5 arası tam sayı',
        evidence: ['Transcript\'ten doğrudan alıntı 1', 'alıntı 2'],
        feedback: 'Bu boyut için gelişim önerisi (1-2 cümle, Türkçe)',
      })),
      overall_score: 'Tüm boyutların ağırlıklı ortalaması (1 ondalık)',
      strengths: ['Güçlü yan 1', 'Güçlü yan 2', 'Güçlü yan 3'],
      development_areas: ['Gelişim alanı 1', 'Gelişim alanı 2'],
      coaching_note: 'Genel koçluk notu (2-3 cümle, yöneticiye hitap eder, Türkçe)',
      manager_insight: 'Yöneticinin güçlü liderlik içgörüsü (1 cümle, Türkçe)',
    },
    null,
    2
  )

  const systemPrompt = `Sen ICF sertifikalı kıdemli bir koçluk değerlendirme uzmanısın. Görevin, bir yöneticinin AI satış temsilcisiyle yaptığı koçluk seansını aşağıdaki rubric boyutlarına göre değerlendirmektir.

## Değerlendirme Rubric'i

${dimensionList}

## Değerlendirme Kuralları

1. Her boyut için 1-5 arası tam sayı ver (ondalık yok).
2. Evidence olarak transcript'ten kelimesi kelimesine kısa alıntılar ver (max 20 kelime).
3. Feedback Türkçe, yapıcı, spesifik ve uygulanabilir olmalı.
4. overall_score: zorunlu boyutlar 1.5x ağırlıkla hesaplanır.
5. Strengths: 2-4 madde, güçlü koçluk davranışları.
6. Development_areas: 1-3 madde, somut gelişim önerileri.
7. coaching_note: Yöneticiye hitap eden genel değerlendirme notu.
8. manager_insight: Yöneticinin öne çıkan tek bir liderlik içgörüsü.

Yanıtını YALNIZCA geçerli JSON formatında ver. Başka metin ekleme.`

  const transcriptText = formatTranscriptForPrompt(transcript)
  const userPrompt = `Aşağıdaki koçluk seansı transkriptini değerlendir:\n\n${transcriptText}\n\n---\n\nYanıt formatı:\n${expectedJsonSchema}`

  return { systemPrompt, userPrompt, dimensions, expectedJsonSchema }
}
