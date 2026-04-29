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
  // evaluations.rubric_template_id NOT NULL — engine bu ID'yi insert'te kullanır.
  rubricTemplateId: string
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

  // Schema notu (migration 005 + 026 + 031): rubric_dimensions kolonları
  //   name (TEXT), description (TEXT), score_labels (JSONB: {"1":"...","2":"...","3":"...","4":"...","5":"..."})
  // dimension_name / level_1_desc gibi kolonlar YOK — score_labels'tan parse ediyoruz.
  const RUBRIC_SELECT = `id, name, rubric_dimensions(dimension_code, name, description, is_required, score_labels)`

  type RubricRow = {
    id: string
    name: string
    rubric_dimensions: {
      dimension_code: string
      name: string
      description: string
      is_required: boolean
      score_labels: Record<string, string> | null
    }[]
  }

  // Çok katmanlı fallback — production'da en az bir rubric'in dönmesini garantile:
  //  1. Tenant'a açıkça atanmış rubric (varsa)
  //  2. is_default=true AND is_active=true global rubric
  //  3. is_active=true herhangi bir rubric (en yeni)
  // Hiçbiri tutmazsa throw — gerçekten boş DB anlamına gelir.
  let rubricRow: RubricRow | null = null

  if (tenantRow?.rubric_template_id) {
    const { data } = await supabase
      .from('rubric_templates')
      .select(RUBRIC_SELECT)
      .eq('id', tenantRow.rubric_template_id)
      .eq('is_active', true)
      .maybeSingle()
    rubricRow = (data as RubricRow | null) ?? null
  }

  if (!rubricRow?.rubric_dimensions?.length) {
    const { data } = await supabase
      .from('rubric_templates')
      .select(RUBRIC_SELECT)
      .eq('is_default', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    rubricRow = (data as RubricRow | null) ?? null
  }

  if (!rubricRow?.rubric_dimensions?.length) {
    // Son çare: aktif olan herhangi bir rubric (created_at en yeni).
    // Bu fallback olmazsa rubric atanmamış tenant'larda evaluation hep patlıyordu.
    const { data } = await supabase
      .from('rubric_templates')
      .select(RUBRIC_SELECT)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    rubricRow = (data as RubricRow | null) ?? null
    if (rubricRow) {
      console.warn(
        `[buildEvaluationPrompt] tenant=${tenantId} için ne atanmış ne de default rubric bulundu — son aktif rubric kullanıldı: ${rubricRow.name}`
      )
    }
  }

  if (!rubricRow?.rubric_dimensions?.length) {
    console.error('[buildEvaluationPrompt] Hiçbir aktif rubric bulunamadı:', {
      tenantId,
      rubricTemplateId: tenantRow?.rubric_template_id,
    })
    throw new Error(`Aktif rubric bulunamadı (tenantId=${tenantId})`)
  }

  const typed: RubricRow = rubricRow

  const dimensions: RubricDimensionForEval[] = typed.rubric_dimensions.map((d) => ({
    dimensionCode: d.dimension_code,
    // Migration 019'daki eski rubric'lerde name NULL olabilir (026'dan önce eklenenler).
    // dimension_code'u okunabilir Türkçe forma çevir: "active_listening" → "Active Listening"
    dimensionName: d.name ?? d.dimension_code.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: d.description ?? '',
    isRequired: d.is_required,
    level1Desc: d.score_labels?.['1'] ?? 'Yeterli değil',
    level3Desc: d.score_labels?.['3'] ?? 'Orta düzey',
    level5Desc: d.score_labels?.['5'] ?? 'Mükemmel',
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

  return { systemPrompt, userPrompt, dimensions, expectedJsonSchema, rubricTemplateId: typed.id }
}
