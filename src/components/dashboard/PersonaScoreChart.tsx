'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'

interface PersonaScore {
  name: string
  avg: number
  sessions: number
}

interface PersonaScoreChartProps {
  data: PersonaScore[]
}

const BAR_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#b45309', '#d97706', '#92400e', '#78350f']

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as PersonaScore
  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-2xl text-sm">
      <p className="font-bold text-foreground mb-1">{d.name}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-amber-500 font-black tabular-nums">{d.avg.toFixed(1)} / 5</span>
        <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-tighter">{d.sessions} seans</span>
      </div>
    </div>
  )
}

export function PersonaScoreChart({ data }: PersonaScoreChartProps) {
  if (!data.length) {
    return (
      <Card className="bg-card/60 border-border border-dashed h-[320px]">
        <CardHeader>
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-500" />
            Persona Bazlı Başarı
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-surface-container-highest flex items-center justify-center">
            <Users className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-xs font-medium text-muted-foreground max-w-[200px]">
            Henüz persona verisi yok. Farklı ekip üyeleriyle seans yaparak başarı oranını gör.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Maksimum 8 persona
  const chartData = data.slice(0, 8)

  return (
    <Card className="bg-card/60 border-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-500" />
          Persona Bazlı Performans
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              type="number"
              domain={[0, 5]}
              ticks={[0, 1, 2, 3, 4, 5]}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: 'hsl(var(--foreground))', fontWeight: 700, width: 80 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }} />
            <Bar
              dataKey="avg"
              radius={[0, 4, 4, 0]}
              barSize={20}
              animationDuration={1500}
            >
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
