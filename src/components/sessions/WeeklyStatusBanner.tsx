import { CheckCircleIcon, ClockIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeeklyStatusBannerProps {
  completedThisWeek: number
  weekStart: Date
}

export function WeeklyStatusBanner({ completedThisWeek, weekStart }: WeeklyStatusBannerProps) {
  const isCompleted = completedThisWeek >= 1

  const weekLabel = weekStart.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
  })

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        isCompleted
          ? 'border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-400'
          : 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400'
      )}
    >
      {isCompleted ? (
        <CheckCircleIcon className="h-5 w-5 shrink-0" />
      ) : (
        <ClockIcon className="h-5 w-5 shrink-0" />
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">
          {isCompleted
            ? `Bu hafta ${completedThisWeek} seans tamamladınız`
            : 'Bu hafta henüz seans tamamlamadınız'}
        </p>
        <p className="text-xs opacity-75">
          {isCompleted
            ? 'Harika! Daha fazlası için yeni seans başlatabilirsiniz.'
            : `${weekLabel} haftası — haftalık minimum 1 seans hedefini tamamlayın.`}
        </p>
      </div>
      {!isCompleted && (
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider opacity-60">
          0 / 1
        </span>
      )}
    </div>
  )
}
