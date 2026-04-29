import { decrypt } from '@/lib/encryption'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { TenantContextProfile } from '@/types'

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
  const [personaResult, scenarioResult, rubricResult, tenantResult] = await Promise.all([
    // Persona: aktif prompt versiyonu + KPI'lar
    supabase
      .from('personas')
      .select(`
        id, name, title, personality_type, emotional_baseline,
        resistance_level, cooperativeness, trigger_behaviors,
        coaching_tips, coaching_context,
        persona_kpis(kpi_code, kpi_name, value, unit),
        persona_prompt_versions(content_encrypted)
      `)
      .eq('id', params.personaId)
      .eq('persona_prompt_versions.is_active', true)
      .single(),

    // Senaryo: bağlam + hedef beceriler + rol bağlamı
    supabase
      .from('scenarios')
      .select('title, context_setup, difficulty_level, target_skills, role_context')
      .eq('id', params.scenarioId)
      .single(),

    // Rubric: aktif template'in zorunlu boyutları
    supabase
      .from('rubric_templates')
      .select(`
        id, name,
        rubric_dimensions(dimension_code, name, description, is_required)
      `)
      .or(`tenant_id.eq.${params.tenantId},tenant_id.is.null`)
      .eq('is_active', true)
      .eq('rubric_dimensions.is_required', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),

    // Tenant: kurum bağlamı
    supabase
      .from('tenants')
      .select('name, context_profile')
      .eq('id', params.tenantId)
      .single(),
  ])

  if (personaResult.error || !personaResult.data) throw new Error('Persona bulunamadı')
  if (scenarioResult.error || !scenarioResult.data) throw new Error('Senaryo bulunamadı')

  const persona = personaResult.data
  const scenario = scenarioResult.data
  const rubric = rubricResult.data
  const tenant = tenantResult.data

  // Persona sistem promptunu şifre çöz
  const activeVersion = (persona.persona_prompt_versions as any)?.[0]
  if (!activeVersion?.content_encrypted) throw new Error('Persona prompt versiyonu bulunamadı')
  const decryptedPersonaPrompt = decrypt(activeVersion.content_encrypted)

  // Kurum bağlamı
  const cp = (tenant?.context_profile ?? {}) as TenantContextProfile
  const tenantLines: string[] = []
  if (cp.company_description) tenantLines.push(cp.company_description)
  if (cp.industry) tenantLines.push(`**Sektör:** ${cp.industry}`)
  if (cp.product_summary) tenantLines.push(`**Ürün / Hizmet:** ${cp.product_summary}`)
  if (cp.company_size) tenantLines.push(`**Büyüklük:** ${cp.company_size}`)
  if (cp.culture_notes) tenantLines.push(`**Kültür:** ${cp.culture_notes}`)
  const tenantContextSection = tenantLines.length
    ? `\n\n## Kurum Bağlamı\n**Şirket:** ${tenant?.name ?? ''}\n${tenantLines.join('\n')}`
    : ''

  // Persona rol bağlamı (senaryoya özel sorumluluklar)
  const roleContextSection = scenario.role_context?.trim()
    ? `\n\n## Persona Rol Bağlamı\n${scenario.role_context.trim()}`
    : ''

  // Persona davranış parametreleri
  const EMOTIONAL_MAP: Record<string, string> = {
    motivated: 'Motive ve enerjik',
    demotivated: 'Motivasyonsuz, isteksiz',
    frustrated: 'Hüsranlı, gergin',
    neutral: 'Nötr',
    anxious: 'Endişeli, temkinli',
    confident: 'Kendinden emin',
    burned_out: 'Tükenmişlik yaşıyor, yorgun',
  }
  const behaviorLines: string[] = []
  if (persona.emotional_baseline) {
    behaviorLines.push(`- **Duygusal Hal:** ${EMOTIONAL_MAP[persona.emotional_baseline as string] ?? persona.emotional_baseline}`)
  }
  if (persona.resistance_level != null) {
    behaviorLines.push(`- **Direnç Seviyesi:** ${persona.resistance_level}/5 — ${persona.resistance_level <= 2 ? 'düşük, kolay işbirliği' : persona.resistance_level >= 4 ? 'yüksek, savunmacı' : 'orta'}`)
  }
  if (persona.cooperativeness != null) {
    behaviorLines.push(`- **İşbirliği Eğilimi:** ${persona.cooperativeness}/5 — ${persona.cooperativeness <= 2 ? 'düşük, kapalı' : persona.cooperativeness >= 4 ? 'yüksek, açık' : 'orta'}`)
  }
  const triggers = (persona.trigger_behaviors as string[] | null)?.filter(Boolean) ?? []
  if (triggers.length) {
    behaviorLines.push(`- **Tetikleyici Davranışlar:** ${triggers.join(', ')}`)
  }
  const coachingTips = Array.isArray(persona.coaching_tips)
    ? (persona.coaching_tips as string[]).filter(Boolean)
    : []
  if (coachingTips.length) {
    behaviorLines.push(`- **Koçluk İpuçları:** ${coachingTips.join(' | ')}`)
  }
  if ((persona.coaching_context as string | null)?.trim()) {
    behaviorLines.push(`- **Koçluk Bağlamı:** ${(persona.coaching_context as string).trim()}`)
  }
  const behaviorSection = behaviorLines.length
    ? `\n\n## Persona Davranış Parametreleri\n${behaviorLines.join('\n')}`
    : ''

  // KPI bölümünü oluştur
  const kpiSection = (persona.persona_kpis as any)?.length
    ? `\n\n## Satış Temsilcisi KPI Profili\n${(persona.persona_kpis as any[])
        .map((k) => `- ${k.kpi_name}: ${k.value} ${k.unit}`)
        .join('\n')}`
    : ''

  // Senaryo bağlamı
  const scenarioSection = `\n\n## Seans Senaryosu\n**Başlık:** ${scenario.title}\n**Zorluk:** ${scenario.difficulty_level}/5\n**Hedef Beceriler:** ${scenario.target_skills?.join(', ') ?? 'Belirtilmemiş'}\n\n**Bağlam:**\n${scenario.context_setup}`

  // ROL HATIRLATMASI — bu bölüm sistemin temel direktifidir
  const roleReminder = `\n\n## EN ÖNEMLİ KURAL — ROL DAĞILIMI

Sen rol-play'de **çalışan/personel** rolündesin. Konuştuğun kişi (kullanıcı) **senin yöneticindir/koçundur**.

- Kullanıcı seninle koçluk pratiği yapıyor. SENİ koçluyor.
- SEN soru SORMAZSIN — sen sorulara cevap verirsin, durumunu paylaşırsın.
- SEN tavsiye VERMEZSİN — sen tavsiye alırsın.
- SEN konuyu yönetmezsin — kullanıcı yönetir, sen takip edersin.
- "Sana nasıl yardımcı olabilirim?", "Ne hissediyorsun?", "Hangi konuda destek istersin?" gibi koç soruları **sen sorma**. Bunları kullanıcı sormalı.
- Kullanıcı kötü/yetersiz koçluk yaparsa bile **sen onu kurtarmaya çalışma**, kendi karakterinde kal. Sıkılırsan sıkıl, kafan karışırsa karışsın, savunmaya geç — persona'na uygun davran.
- Kendini tanıtma cümleleri ("Ben buradayım seni dinlemek için...") koç cümlesidir, KULLANMA.

### Yarım Cümle ve Belirsiz Girdiler

- Kullanıcı bir cümleyi yarıda bırakırsa (örn. "Şirket olarak bizim kültürümüzde aslında..."), **kendi başına tamamlama**. Konuyu sen yönetme, sen savurma.
- Kısa onay ile karşılık ver: "Evet?", "Devam edin", "Sizi dinliyorum" yeterli. Sonra sus, kullanıcının devam etmesini bekle.
- Kullanıcı çok kısa veya anlamsız bir şey söylerse ("evet", "hı", "tamam") aynı şekilde minimum yanıt ver — uzun açıklama veya yeni içerik üretme.
- Whisper halüsinasyonu izlenimi veren ifadeleri (örn. "Altyazı M.K.", "İzlediğiniz için teşekkürler") fark edersen, son anlamlı kullanıcı mesajına dönüp ona yanıt ver — phantom'a anlam yükleme.

Kısacası: Sen sahnedeki KARAKTERSİN, seyirci değil. Kullanıcının çıkacağı yolu sen göstermezsin; sen sadece kendi rolünü oynarsın.`

  // Rubric boyutları — KOÇ (kullanıcı) bu boyutlarda değerlendirilecek; AI persona DEĞİL.
  const rubricSection = (rubric as any)?.rubric_dimensions?.length
    ? `\n\n## Değerlendirme Bağlamı (sadece bilgi — kendin uygulama)
Seans sonrası **kullanıcının (koçun)** koçluk becerileri aşağıdaki boyutlarda değerlendirilecek:
${(rubric as any).rubric_dimensions
        .map((d: any) => `- **${d.name ?? d.dimension_code}**: ${d.description ?? ''}`)
        .join('\n')}

Bu boyutlar SENİ ilgilendirmez. Sen sadece kendi karakterini oyna. Kullanıcı bu becerileri uygulamaya çalışacak; sen bu uygulamaya organik bir tepki ver — iyi yapıyorsa açıl, kötü yapıyorsa kapan, kendi karakterine uygun.`
    : ''

  // Faz takibi — sadece sistem etiketleme; AI'ın "yönlendirmesi gereken" fazlar DEĞİL.
  const phaseDirectives = `\n\n## Faz Takibi (sadece etiketleme — sen davranışını değiştirme)

Her yanıtının EN SONUNA aşağıdaki etiketi ekle. **Bu etiket kullanıcıya GÖSTERİLMEZ, sesli okunmaz, sistem tarafından stripped edilir. Kullanıcıya sadece doğal cevabını söyle.**

[PHASE:opening|exploration|deepening|action|closing]

Etiketi seçerken **KULLANICININ (koçun)** seansı hangi aşamada yürüttüğüne bakarak karar ver:
- **opening**: Kullanıcı henüz tanışıyor / bağlamı açıyor.
- **exploration**: Kullanıcı senin durumunu keşfediyor, sorular soruyor.
- **deepening**: Kullanıcı duygu/varsayım/derin neden sorguluyor.
- **action**: Kullanıcı seninle aksiyon planı kuruyor, taahhüt alıyor.
- **closing**: Kullanıcı seansı kapatma sinyali veriyor (özet, vedalaşma).

ÖNEMLİ: Bu etiket sadece organizasyonel — sen davranışını fazlara göre değiştirme. Karakterin sabit kalır, kullanıcının yaklaşımına göre tepkin değişir, sen kendin "şimdi exploration'a geçiyorum" diye yön vermezsin.

### Seans Sonu Kuralları (KESİN)

[SESSION_END] marker'ını YALNIZCA aşağıdaki koşullardan biri sağlandığında kullan:

1. Toplam **en az 13 user-assistant turu** tamamlanmış VE kullanıcı açıkça kapanış yapıyor (özet + veda), VEYA
2. Kullanıcı açıkça "seansı bitirelim", "yeter, teşekkürler", "şimdilik bu kadar yeterli" gibi net bitiş niyeti ifade etmiş.

"tamam/evet/olur" kısa onaylar bitiş niyeti SAYILMAZ. Whisper halüsinasyonlarını umursama. Şüphe halinde [SESSION_END] BASMA — kendi rolünde kalıp kullanıcının yönlendirmesini bekle.`

  // roleReminder TÜM bölümlerden ÖNCE — AI'ın aklında bu kuralın baskın olması için.
  const systemPrompt = `${decryptedPersonaPrompt}${roleReminder}${tenantContextSection}${roleContextSection}${behaviorSection}${kpiSection}${scenarioSection}${rubricSection}${phaseDirectives}`

  return {
    systemPrompt,
    personaName: persona.name,
    scenarioTitle: scenario.title,
  }
}
