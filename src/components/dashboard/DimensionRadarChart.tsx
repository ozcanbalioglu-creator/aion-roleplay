'use client'

import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crosshair } from 'lucide-react'

interface DimensionAvg {
  dimension: string
  code: string
  avg: number
  count: number
}

interface DimensionRadarChartProps {
  data: DimensionAvg[]
}

// Boyut adlarını kısalt
function abbreviate(name: string): string {
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

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as DimensionAvg
  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-2xl text-sm">
      <p className="font-bold text-foreground mb-1">{d.dimension}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-amber-500 font-black tabular-nums">{d.avg.toFixed(1)} / 5</span>
        <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-tighter">{d.count} seans</span>
      </div>
    </div>
  )
}

export function DimensionRadarChart({ data }: DimensionRadarChartProps) {
  if (!data.length) {
    return (
      <Card className="bg-card/60 border-border border-dashed h-[320px]">
        <CardHeader>
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-amber-500" />
            Koçluk Yetkinlik Matrisi
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-surface-container-highest flex items-center justify-center">
            <Crosshair className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-xs font-medium text-muted-foreground max-w-[200px]">
            Henüz değerlendirme verisi yok. Yetkinlik dağılımını görmek için seansları tamamla.
          </p>
        </CardContent>
      </Card>
    )
  }

  // İki katmanlı radar: arka planda "max=5" silik halkası (potansiyel),
  // önde gerçek skorlar (kazanılan). Bu ikinin kontrastı kullanıcının
  // "ne kadar yolu kaldığını" görsel olarak hızlıca anlamasını sağlar.
  const chartData = data.map((d) => ({
    ...d,
    subject: abbreviate(d.dimension),
    max: 5, // referans halkası
  }))

  return (
    <Card className="bg-card/60 border-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-amber-500" />
          Koçluk Yetkinlik Matrisi
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={chartData} margin={{ top: 20, right: 40, left: 40, bottom: 20 }}>
            <PolarGrid stroke="hsl(var(--border))" opacity={0.6} />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 700, letterSpacing: '0.05em' }}
            />
            {/* Sabit eksen: 0-5, hem mavi hem amber ölçek üzerinde aynı domain */}
            <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />

            {/* 1. Arka plan: max=5 silik mor halkası (potansiyel/hedef) */}
            <Radar
              name="Hedef"
              dataKey="max"
              stroke="#9d6bdf"
              fill="#9d6bdf"
              fillOpacity={0.08}
              strokeOpacity={0.3}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />

            {/* 2. Önde: gerçek skor amber poligonu */}
            <Radar
              name="Ortalama"
              dataKey="avg"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.35}
              strokeWidth={3}
              dot={{ fill: '#f59e0b', stroke: 'hsl(var(--background))', strokeWidth: 1, r: 3 }}
              animationDuration={1500}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
