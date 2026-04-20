'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { DashboardPeriod } from '@/lib/queries/dashboard.queries'
import { Suspense } from 'react'

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: 'week', label: 'Bu Hafta' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'all', label: 'Tüm Zamanlar' },
]

interface PeriodFilterInnerProps {
  currentPeriod: DashboardPeriod
}

function PeriodFilterInner({ currentPeriod }: PeriodFilterInnerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setPeriod = (period: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString())
    if (period === 'all') {
      params.delete('period')
    } else {
      params.set('period', period)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center bg-surface-container-highest/50 backdrop-blur-sm rounded-full p-1 gap-1 border border-border/40">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => setPeriod(p.value)}
          className={cn(
            'px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300',
            currentPeriod === p.value
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

export function PeriodFilter({ currentPeriod }: PeriodFilterInnerProps) {
  return (
    <Suspense fallback={<div className="h-9 w-64 bg-muted/20 animate-pulse rounded-full" />}>
      <PeriodFilterInner currentPeriod={currentPeriod} />
    </Suspense>
  )
}
