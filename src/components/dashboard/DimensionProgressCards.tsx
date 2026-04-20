'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DimensionDelta {
  code: string
  dimension: string
  avg: number
  prevAvg: number | null
  delta: number | null
}

interface DimensionProgressCardsProps {
  dimensions: DimensionDelta[]
}

function getLabel(avg: number): { text: string; className: string } {
  if (avg >= 4.0) return { text: 'Güçlü', className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' }
  if (avg >= 3.0) return { text: 'Gelişiyor', className: 'text-amber-500 bg-amber-500/10 border-amber-500/20' }
  return { text: 'Odaklan', className: 'text-orange-500 bg-orange-500/10 border-orange-500/20' }
}

export function DimensionProgressCards({ dimensions }: DimensionProgressCardsProps) {
  if (!dimensions.length) return null

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-amber-500" />
          Kritik Koçluk Yetkinlikleri (Aylık Kıyas)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dimensions.map((d) => {
            const label = getLabel(d.avg)
            const barWidth = ((d.avg - 1) / 4) * 100

            return (
              <div key={d.code} className="space-y-3 p-4 rounded-2xl bg-surface-container-low border border-border/40 group hover:border-primary/20 transition-all duration-300">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-tight text-foreground/80 group-hover:text-primary transition-colors leading-tight">
                    {d.dimension}
                  </span>
                  <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-transparent', label.className)}>
                    {label.text}
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black tabular-nums tracking-tighter">{d.avg.toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">/ 5</span>
                  </div>
                  
                  {d.delta != null && d.delta !== 0 && (
                    <div className={cn(
                      'text-[10px] font-black flex items-center gap-1 px-2 py-0.5 rounded border italic',
                      d.delta > 0 ? 'text-emerald-500 border-emerald-500/10 bg-emerald-500/5' : 'text-red-500 border-red-500/10 bg-red-500/5'
                    )}>
                      {d.delta > 0
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(d.delta).toFixed(1)}
                    </div>
                  )}
                  {d.delta === 0 && (
                    <div className="text-[10px] font-black text-muted-foreground px-2 py-0.5 rounded border border-border/10 bg-muted/5 italic">
                      <Minus className="h-3 w-3" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                   <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden shadow-inner">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000 ease-out shadow-sm',
                        d.avg >= 4.0 ? 'bg-emerald-500' : d.avg >= 3.0 ? 'bg-amber-500' : 'bg-orange-500'
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
