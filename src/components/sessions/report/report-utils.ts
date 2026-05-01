/**
 * Seans raporu için ortak utility'ler:
 * - status pill (genel skoru sözel etikete çevirir)
 * - skor renk kategorisi (low/mid/high)
 * - ICF dimension code → varsayılan Türkçe ad fallback
 *
 * Tüm bileşenlerin kullandığı tek kaynak.
 */

export type ScoreBand = 'critical' | 'developing' | 'growing' | 'solid' | 'mastery'

export interface StatusPill {
  band: ScoreBand
  label: string
  pillClass: string
}

/**
 * Genel skoru (0-5) → durum etiketi.
 * RAPOR_REDESIGN_TASLAK.md'deki 5 seviyeli sınıflandırma.
 */
export function getStatusPill(overall: number): StatusPill {
  if (overall < 2)    return { band: 'critical',   label: 'Yeniden Yapılandırma Gerekiyor', pillClass: 'status-pill-critical' }
  if (overall < 3)    return { band: 'developing', label: 'Temel Gelişim Aşamasında',         pillClass: 'status-pill-developing' }
  if (overall < 3.5)  return { band: 'growing',    label: 'Gelişen Liderlik Profili',         pillClass: 'status-pill-growing' }
  if (overall < 4.5)  return { band: 'solid',      label: 'Sağlam Koçluk Becerisi',           pillClass: 'status-pill-solid' }
  return                       { band: 'mastery',   label: 'Üst Düzey Koçluk Ustalığı',        pillClass: 'status-pill-mastery' }
}

/**
 * Skor → renk kategorisi (bar gradyan + legend dot).
 */
export function getScoreCategory(score: number): 'low' | 'mid' | 'high' {
  if (score < 3) return 'low'
  if (score < 4) return 'mid'
  return 'high'
}

/**
 * Skor → CSS değişkeni (#hex). Radar legend, action panel skorları, vb.
 */
export function getScoreColor(score: number): string {
  if (score >= 4) return '#4CAF82' // good
  if (score >= 3) return '#9D6BDF' // accent
  return '#E8A534'                // warn
}

/**
 * ICF dimension_code → Türkçe ad. DB'de rubric_dimensions.name boş ise fallback.
 */
export const ICF_DIMENSION_LABELS: Record<string, string> = {
  ethical_practice:        'Etik Uygulamaları Sergiler',
  coaching_mindset:        'Koçluk Zihniyetini Somutlaştırır',
  establishes_agreements:  'Anlaşmaları Kurar ve Sürdürür',
  cultivates_trust:        'Güven ve Güvenlik Geliştirir',
  maintains_presence:      'Varlığını Sürdürür',
  listens_actively:        'Aktif Dinleme',
  evokes_awareness:        'Farkındalık Yaratır',
  facilitates_growth:      'Danışanın Gelişimini Kolaylaştırır',
  // Geriye dönük uyumluluk (eski seed)
  active_listening:        'Aktif Dinleme',
  powerful_questions:      'Güçlü Sorular',
  direct_communication:    'Doğrudan İletişim',
  creating_awareness:      'Farkındalık Yaratma',
  designing_actions:       'Aksiyon Tasarımı',
  managing_progress:       'İlerleme Yönetimi',
}

/**
 * Code'dan kısa "ilk kelime" çıkar (radar etiketi, en güçlü/en zayıf chip için).
 */
export function shortDimName(name: string | null | undefined, code: string): string {
  const full = name?.trim() || ICF_DIMENSION_LABELS[code] || code
  // İlk 2 kelimeyi al
  return full.split(/\s+/).slice(0, 2).join(' ')
}

/**
 * Tüm boyutu render-ready forma getirir (eksik alanlar fallback'e düşer).
 */
export interface DimensionScoreRow {
  dimension_code: string
  score: number
  evidence_quotes: string[] | null
  improvement_tip: string | null
  rationale: string | null
  name: string | null
  description: string | null
  is_required: boolean
  sort_order: number
}

export interface ReportDimension {
  code: string
  name: string
  description: string
  is_required: boolean
  sort_order: number
  score: number
  evidence_quotes: string[]
  improvement_tip: string
  rationale: string
}

export function normalizeDimensions(rows: DimensionScoreRow[]): ReportDimension[] {
  return rows.map((r) => ({
    code: r.dimension_code,
    name: r.name?.trim() || ICF_DIMENSION_LABELS[r.dimension_code] || r.dimension_code,
    description: r.description?.trim() || '',
    is_required: r.is_required,
    sort_order: r.sort_order ?? 99,
    score: Number(r.score) || 0,
    evidence_quotes: Array.isArray(r.evidence_quotes) ? r.evidence_quotes.filter(Boolean) : [],
    improvement_tip: r.improvement_tip?.trim() || '',
    rationale: r.rationale?.trim() || '',
  }))
}

/**
 * Genel ortalama: dimension_scores varsa onların ortalaması, yoksa overall_score.
 */
export function computeOverallAverage(dims: ReportDimension[], fallback: number): number {
  if (!dims.length) return fallback
  const sum = dims.reduce((acc, d) => acc + d.score, 0)
  return sum / dims.length
}

/**
 * Saniye → "18 dk 42 sn" / "32 sn".
 */
export function formatDuration(durationSeconds: number | null | undefined): string {
  if (!durationSeconds || durationSeconds <= 0) return '—'
  const min = Math.floor(durationSeconds / 60)
  const sec = Math.round(durationSeconds % 60)
  if (min === 0) return `${sec} sn`
  if (sec === 0) return `${min} dk`
  return `${min} dk ${sec} sn`
}
