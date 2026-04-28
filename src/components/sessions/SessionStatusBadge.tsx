import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// session_status enum + evaluation_failed (migration 040) + debrief_active/completed (migration 038)
type SessionStatus =
  | 'pending'
  | 'active'
  | 'debrief_active'
  | 'debrief_completed'
  | 'completed'
  | 'evaluation_failed'
  | 'cancelled'
  | 'dropped'
  | 'failed'

// Light + dark adaptive renkler. Eskiden sadece text-*-400 + bg-*-500/10 vardı,
// light tema'da yazı arka plan rengiyle aynı yumuşaklıkta görünüp okunmuyordu.
// Yeni şema: light için solid (bg-100, text-700), dark için soluk (bg-500/10, text-400).
const STATUS_CONFIG: Record<SessionStatus, { label: string; className: string }> = {
  pending: {
    label: 'Hazırlanıyor',
    className: 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  },
  active: {
    label: 'Devam Ediyor',
    className: 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  debrief_active: {
    label: 'Geri Bildirim',
    className: 'border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
  },
  debrief_completed: {
    label: 'Geri Bildirim Tamam',
    className: 'border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300',
  },
  completed: {
    label: 'Tamamlandı',
    className: 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  },
  evaluation_failed: {
    label: 'Değerlendirme Başarısız',
    className: 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  },
  cancelled: {
    label: 'İptal Edildi',
    className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-300',
  },
  dropped: {
    label: 'Yarıda Kaldı',
    className: 'border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
  },
  failed: {
    label: 'Hata',
    className: 'border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  },
}

interface SessionStatusBadgeProps {
  status: SessionStatus | string
  className?: string
}

export function SessionStatusBadge({ status, className }: SessionStatusBadgeProps) {
  const config = STATUS_CONFIG[status as SessionStatus] ?? STATUS_CONFIG.failed
  return (
    <Badge variant="outline" className={cn('font-medium', config.className, className)}>
      {config.label}
    </Badge>
  )
}
