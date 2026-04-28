'use client'

import { StatCard } from '@/components/dashboard/StatCard'
import { Activity, CheckSquare, Trophy, Users } from 'lucide-react'

interface TeamStatCardsProps {
  totalUsers: number
  activeUsers: number
  avgScore: number | null
  totalSessions: number
  weeklyCompletionRate: number | null
}

export function TeamStatCards({
  totalUsers,
  activeUsers,
  avgScore,
  totalSessions,
  weeklyCompletionRate,
}: TeamStatCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Toplam Üye"
        value={totalUsers}
        icon={Users}
        iconColor="text-primary"
        subtitle={`${activeUsers} aktif bu dönem`}
      />
      <StatCard
        title="Tamamlanan Seans"
        value={totalSessions}
        icon={Activity}
        iconColor="text-emerald-400"
        subtitle="bu dönem"
      />
      <StatCard
        title="Takım Ort. Puanı"
        value={avgScore}
        suffix="/5"
        icon={Trophy}
        iconColor="text-amber-400"
        animateValue={false}
        subtitle={avgScore == null ? 'Henüz veri yok' : undefined}
      />
      <StatCard
        title="Haftalık Katılım"
        value={weeklyCompletionRate}
        suffix="%"
        icon={CheckSquare}
        iconColor="text-blue-400"
        subtitle="bu hafta seans yapan"
      />
    </div>
  )
}
