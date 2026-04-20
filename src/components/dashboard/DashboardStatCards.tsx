'use client'

import { StatCard } from './StatCard'
import { Trophy, Target, Flame, Zap } from 'lucide-react'

interface DashboardStatCardsProps {
  totalSessions: number
  avgScore: number | null
  currentStreak: number
  xpPoints: number
  level: number
}

export function DashboardStatCards({
  totalSessions,
  avgScore,
  currentStreak,
  xpPoints,
  level,
}: DashboardStatCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Ort. Koçluk Puanı"
        value={avgScore}
        suffix="/5"
        icon={Trophy}
        iconColor="text-amber-500"
        subtitle={totalSessions > 0 ? `${totalSessions} seans ortalaması` : 'Henüz seans yok'}
        animateValue={false}
      />
      <StatCard
        title="Tamamlanan Seans"
        value={totalSessions}
        icon={Target}
        iconColor="text-primary"
        subtitle="Toplam deneyim"
      />
      <StatCard
        title="Aktif Seri"
        value={currentStreak}
        suffix=" GÜN"
        icon={Flame}
        iconColor="text-orange-500"
        subtitle={currentStreak >= 3 ? '🔥 Ritmini koruyorsun!' : 'Gelişim için her gün pratik yap'}
      />
      <StatCard
        title="Toplam XP"
        value={xpPoints}
        icon={Zap}
        iconColor="text-amber-400"
        subtitle={`Seviye ${level} Koç`}
      />
    </div>
  )
}
