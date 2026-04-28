'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart2 } from 'lucide-react'

interface DimensionAvg {
  code: string
  dimension: string
  avg: number
  count: number
}

interface TeamDimensionChartProps {
  data: DimensionAvg[]
}

function shorten(name: string) {
  const map: Record<string, string> = {
    'Aktif Dinleme': 'Dinleme',
    'Güçlü Sorular': 'Sorular',
    'Doğrudan İletişim': 'İletişim',
    'Farkındalık Yaratma': 'Farkındalık',
    'Aksiyon Tasarımı': 'Aksiyon',
    'İlerleme Yönetimi': 'İlerleme',
  }
  return map[name] ?? name.split(' ')[0]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: DimensionAvg }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as DimensionAvg

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium">{d.dimension}</p>
      <p className="text-amber-400 font-bold">{d.avg.toFixed(1)} / 5.0</p>
      <p className="text-xs text-muted-foreground">{d.count} ölçüm</p>
    </div>
  )
}

export function TeamDimensionChart({ data }: TeamDimensionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardContent className="h-52 flex items-center justify-center text-sm text-muted-foreground">
          Boyut verisi yok
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((d) => ({ ...d, label: shorten(d.dimension) }))
  const teamAvg = data.reduce((sum, d) => sum + d.avg, 0) / data.length

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Takım Boyut Performansı
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Takım ort: <span className="text-amber-400 font-semibold">{teamAvg.toFixed(1)}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
            <ReferenceLine
              y={teamAvg}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {chartData.map((d) => (
                <Cell
                  key={d.code}
                  fill={d.avg >= 4 ? '#10b981' : d.avg >= 3 ? '#f59e0b' : '#f97316'}
                  opacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
