'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string | null
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string } | null
  suffix?: string
  animateValue?: boolean
}

function useCountUp(target: number, duration = 800) {
  const [current, setCurrent] = useState(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [target, duration])

  return current
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  trend,
  suffix = '',
  animateValue = true,
}: StatCardProps) {
  const numericValue = typeof value === 'number' ? value : null
  const animated = useCountUp(numericValue ?? 0)
  const displayValue = value == null
    ? '—'
    : animateValue && numericValue != null
    ? `${animated}${suffix}`
    : `${value}${suffix}`

  return (
    <Card className="bg-card/60 border-border group hover:border-primary/30 transition-all duration-300">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
              {title}
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight font-headline">
              {displayValue}
            </p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground italic">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6',
            'bg-surface-container-highest border border-border/50'
          )}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>

        {trend && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <span className={cn(
              'text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider',
              trend.value > 0 ? 'text-emerald-500' : trend.value < 0 ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'}
              {Math.abs(trend.value)} {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
