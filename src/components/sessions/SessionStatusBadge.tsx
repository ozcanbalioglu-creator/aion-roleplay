import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type SessionStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'dropped' | 'failed'

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; className: string }
> = {
  pending:   { label: 'Hazırlanıyor', className: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
  active:    { label: 'Devam Ediyor', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  completed: { label: 'Tamamlandı',   className: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  cancelled: { label: 'İptal Edildi', className: 'border-muted bg-muted/30 text-muted-foreground' },
  dropped:   { label: 'Yarıda Kaldı', className: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
  failed:    { label: 'Hata',         className: 'border-red-500/30 bg-red-500/10 text-red-400' },
}

interface SessionStatusBadgeProps {
  status: SessionStatus
  className?: string
}

export function SessionStatusBadge({ status, className }: SessionStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.failed
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {config.label}
    </Badge>
  )
}
