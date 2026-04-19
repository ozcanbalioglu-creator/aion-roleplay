import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMM yyyy', { locale: tr })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMM yyyy, HH:mm', { locale: tr })
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: tr })
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}sn`
  if (secs === 0) return `${mins}dk`
  return `${mins}dk ${secs}sn`
}

export function formatScore(score: number): string {
  return score.toFixed(1)
}

export function formatPoints(points: number): string {
  if (points >= 1000) return `${(points / 1000).toFixed(1)}K`
  return points.toString()
}

export function getScoreColor(score: number): string {
  if (score >= 4) return 'text-[color:var(--color-score-high)]'
  if (score >= 2.5) return 'text-[color:var(--color-score-mid)]'
  return 'text-[color:var(--color-score-low)]'
}

export function getScoreBg(score: number): string {
  if (score >= 4) return 'bg-[color:var(--color-score-high)]/10'
  if (score >= 2.5) return 'bg-[color:var(--color-score-mid)]/10'
  return 'bg-[color:var(--color-score-low)]/10'
}
