'use client'

import {
  Area, AreaChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'

interface ScoreTrendData {
  index: number
  date: string
  score: number
  persona: string
}

interface ScoreTrendChartProps {
  data: ScoreTrendData[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ScoreTrendData
  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl p-4 shadow-2xl text-sm min-w-[160px]">
      <p className="font-bold text-foreground mb-1">{d.persona}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{d.date}</span>
        <span className="text-amber-500 font-black tabular-nums">{d.score.toFixed(1)} / 5</span>
      </div>
    </div>
  )
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (!data.length) {
    return (
      <Card className="bg-card/60 border-border border-dashed h-[320px]">
        <CardHeader>
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            Skor Gelişim Trendi
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-surface-container-highest flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-xs font-medium text-muted-foreground max-w-[200px]">
            Henüz seans verisi yok. İlk seansını tamamla ve koçluk gelişimini izle.
          </p>
        </CardContent>
      </Card>
    )
  }

  const avg = data.reduce((s, d) => s + d.score, 0) / data.length

  return (
    <Card className="bg-card/60 border-border overflow-hidden group">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            Skor Gelişim Trendi
          </CardTitle>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter">Ort:</span>
            <span className="text-[10px] font-black text-amber-600 tabular-nums">{avg.toFixed(1)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(245, 158, 11, 0.2)', strokeWidth: 2 }} />
            <ReferenceLine
              y={avg}
              stroke="hsl(var(--primary))"
              strokeDasharray="4 4"
              strokeOpacity={0.3}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#f59e0b"
              strokeWidth={3}
              fill="url(#scoreGradient)"
              dot={{ fill: 'hsl(var(--background))', stroke: '#f59e0b', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#f59e0b', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
