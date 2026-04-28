const MAX_CHARS = 4500

interface DimensionFeedback {
  code: string
  name: string
  feedback: string
}

interface ReportNarrationParams {
  firstName: string
  personaName: string
  scenarioTitle: string
  coachingNote: string
  strengths: string[]
  developmentAreas: string[]
  dimensionFeedbacks: DimensionFeedback[]
}

export function buildReportNarration(params: ReportNarrationParams): string {
  const {
    firstName,
    personaName,
    scenarioTitle,
    coachingNote,
    strengths,
    developmentAreas,
    dimensionFeedbacks,
  } = params

  const parts: string[] = []

  parts.push(
    `Merhaba ${firstName}. ${personaName} ile yaptığın "${scenarioTitle}" seansının sesli değerlendirmesini hazırladım.`
  )

  if (coachingNote?.trim()) {
    parts.push(coachingNote.trim())
  }

  if (strengths.length > 0) {
    parts.push(`Bu seansın güçlü yönlerin: ${strengths.join('. ')}.`)
  }

  if (developmentAreas.length > 0) {
    parts.push(`Gelişim fırsatların: ${developmentAreas.join('. ')}.`)
  }

  for (const dim of dimensionFeedbacks) {
    if (dim.feedback?.trim()) {
      parts.push(`${dim.name}: ${dim.feedback.trim()}`)
    }
  }

  parts.push('Bir sonraki seansında başarılar!')

  const text = parts.join('\n\n')
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '...' : text
}
