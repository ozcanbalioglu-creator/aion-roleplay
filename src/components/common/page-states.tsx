import { Loader2, Inbox, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

// ─── Loading State ───────────────────────────────────────────────────────────

interface LoadingProps {
  message?: string
  className?: string
}

export function PageLoading({ message = 'Yükleniyor...', className }: LoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function PageEmpty({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-16 text-center', className)}>
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  )
}

// ─── Error State ─────────────────────────────────────────────────────────────

interface ErrorProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function PageError({
  title = 'Bir hata oluştu',
  description = 'Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.',
  onRetry,
  className
}: ErrorProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-16 text-center', className)}>
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Tekrar Dene
        </Button>
      )}
    </div>
  )
}

// ─── Inline Skeleton Helpers ─────────────────────────────────────────────────

import { Skeleton } from '@/components/ui/skeleton'

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  )
}
