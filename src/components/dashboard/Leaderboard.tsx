'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trophy, Crown, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardResult } from '@/lib/queries/leaderboard.queries'

interface LeaderboardProps {
  /** Server'da paralel çekilen 3 dönem sonucu — tabs lokal state ile aralarında geçer. */
  data: Record<LeaderboardPeriod, LeaderboardResult>
  initialPeriod?: LeaderboardPeriod
}

const TABS: Array<{ key: LeaderboardPeriod; label: string }> = [
  { key: 'week', label: 'Bu Hafta' },
  { key: 'month', label: 'Bu Ay' },
  { key: 'all', label: 'Tüm Zamanlar' },
]

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-500" />
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />
  return null
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-xl transition-colors',
        entry.is_current_user
          ? 'bg-amber-500/10 border border-amber-500/30 shadow-sm'
          : 'hover:bg-surface-container-low',
      )}
    >
      <div className="flex items-center justify-center w-10 h-10 flex-shrink-0">
        {rankIcon(entry.rank) ?? (
          <span className="text-sm font-black tabular-nums text-muted-foreground">
            #{entry.rank}
          </span>
        )}
      </div>

      <Avatar className="h-9 w-9 flex-shrink-0 border border-border/40">
        <AvatarImage src={entry.avatar_url ?? undefined} alt={entry.full_name} className="object-cover" />
        <AvatarFallback className="text-xs font-bold bg-surface-container-highest text-on-primary-container">
          {getInitials(entry.full_name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-semibold truncate',
          entry.is_current_user ? 'text-amber-600' : 'text-foreground',
        )}>
          {entry.full_name}
          {entry.is_current_user && (
            <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-amber-500">SEN</span>
          )}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Seviye {entry.level}
        </p>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-base font-bold tabular-nums text-foreground">
          {entry.xp.toLocaleString('tr-TR')}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
          Deneyim Puanı
        </span>
      </div>
    </div>
  )
}

export function Leaderboard({ data, initialPeriod = 'week' }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardPeriod>(initialPeriod)
  const current = data[activeTab]

  // current user top 10'da değilse sona ek satır ekle
  const showCurrentUserExtra =
    current.current_user_entry !== null && !current.entries.some(e => e.is_current_user)

  return (
    <Card className="bg-surface-container-low border-border/40 shadow-sm">
      <CardHeader className="pb-2 border-b border-border/20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Sıralama Tablosu
          </CardTitle>

          <div className="flex items-center gap-1 bg-surface-container rounded-full p-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full transition-all',
                  activeTab === tab.key
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {current.entries.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center opacity-60">
            <Trophy className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground italic">
              Bu dönem için henüz puan yok. Seans tamamlayanlar burada görünecek.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {current.entries.map(entry => (
              <LeaderboardRow key={entry.user_id} entry={entry} />
            ))}

            {showCurrentUserExtra && current.current_user_entry && (
              <>
                <div className="my-2 border-t border-dashed border-border/40 relative">
                  <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-surface-container-low px-2 text-[9px] uppercase tracking-widest text-muted-foreground/60">
                    senin yerin
                  </span>
                </div>
                <LeaderboardRow entry={current.current_user_entry} />
              </>
            )}
          </div>
        )}

        <p className="mt-4 text-[10px] text-muted-foreground/60 italic text-center">
          Aynı kurumdan {current.total_users} kullanıcı yarışıyor
        </p>
      </CardContent>
    </Card>
  )
}
