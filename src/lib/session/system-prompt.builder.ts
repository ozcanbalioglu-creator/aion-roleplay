import { decrypt } from '@/lib/encryption'
import { createServiceRoleClient } from '@/lib/supabase/server'

interface BuildSystemPromptParams {
  sessionId: string
  personaId: string
  scenarioId: string
  tenantId: string
}

interface SystemPromptData {
  systemPrompt: string
  personaName: string
  scenarioTitle: string
}

export async function buildSystemPrompt(params: BuildSystemPromptParams): Promise<SystemPromptData> {
  const supabase = await createServiceRoleClient()

  // Tüm veriyi paralel çek
  const [personaResult, scenarioResult, rubricResult] = await Promise.all([
    // Persona: aktif prompt versiyonu + KPI'lar
    supabase
      .from('personas')
      .select(`
        id, name, title, personality_type, emotional_baseline,
        resistance_level, cooperativeness, trigger_behaviors,
        persona_kpis(kpi_code, kpi_name, value, unit),
        persona_prompt_versions(encrypted_content)
      `)
      .eq('id', params.personaId)
      .eq('persona_prompt_versions.is_active', true)
      .single(),

    // Senaryo: bağlam + hedef beceriler
    supabase
      .from('scenarios')
      .select('title, context_setup, difficulty_level, target_skills')
      .eq('id', params.scenarioId)
      .single(),

    // Rubric: aktif template'in zorunlu boyutları
    supabase
      .from('rubric_templates')
      .select(`
        id, name,
        rubric_dimensions(dimension_code, dimension_name, description, is_required)
      `)
      .or(`tenant_id.eq.${params.tenantId},tenant_id.is.null`)
      .eq('is_active', true)
      .eq('rubric_dimensions.is_required', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  if (personaResult.error || !personaResult.data) throw new Error('Persona bulunamadı')
  if (scenarioResult.error || !scenarioResult.data) throw new Error('Senaryo bulunamadı')

  const persona = personaResult.data
  const scenario = scenarioResult.data
  const rubric = rubricResult.data

  // Persona sistem promptunu şifre çöz
  const activeVersion = (persona.persona_prompt_versions as any)?.[0]
  if (!activeVersion?.encrypted_content) throw new Error('Persona prompt versiyonu bulunamadı')
  const decryptedPersonaPrompt = decrypt(activeVersion.encrypted_content)

  // KPI bölümünü oluştur
  const kpiSection = (persona.persona_kpis as any)?.length
    ? `\n\n## Satış Temsilcisi KPI Profili\n${(persona.persona_kpis as any[])
        .map((k) => `- ${k.kpi_name}: ${k.value} ${k.unit}`)
        .join('\n')}`
    : ''

  // Senaryo bağlamı
  const scenarioSection = `\n\n## Seans Senaryosu\n**Başlık:** ${scenario.title}\n**Zorluk:** ${scenario.difficulty_level}/5\n**Hedef Beceriler:** ${scenario.target_skills?.join(', ') ?? 'Belirtilmemiş'}\n\n**Bağlam:**\n${scenario.context_setup}`

  // Rubric boyutları (AI'a değerlendirme kriterlerini bildir)
  const rubricSection = (rubric as any)?.rubric_dimensions?.length
    ? `\n\n## Değerlendirme Kriterleri (Koçun Kullanacağı Boyutlar)\nBu seans aşağıdaki ICF-ilhamlı boyutlara göre değerlendirilecektir. Konuşma sırasında bu boyutları aktive edecek sorular sor:\n${(rubric as any).rubric_dimensions
        .map((d: any) => `- **${d.dimension_name}**: ${d.description}`)
        .join('\n')}`
    : ''

  // Faz yönetimi direktifleri
  const phaseDirectives = `\n\n## Seans Fazı Yönetimi
Her yanıtının sonuna mevcut seans fazını şu formatta ekle (kullanıcıya gösterme, sadece sistem için):
[PHASE:opening|exploration|deepening|action|closing]

Faz geçiş kuralları:
- **opening**: İlk 2-3 mesaj. Kendini tanıt, senaryo bağlamını kur.
- **exploration**: Sorun ve durumu keşfet. Açık uçlu sorular sor.
- **deepening**: Varsayımları sorgula, yansıtma yap, derinleştir.
- **action**: Somut aksiyonlar belirle, taahhüt al.
- **closing**: Özet yap, güçlü yanları vurgula, seansı kapat.

Seansı tamamladığında (closing fazının sonunda) yanıtının en sonuna şunu ekle:
[SESSION_END]`

  const systemPrompt = `${decryptedPersonaPrompt}${kpiSection}${scenarioSection}${rubricSection}${phaseDirectives}`

  return {
    systemPrompt,
    personaName: persona.name,
    scenarioTitle: scenario.title,
  }
}
