'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Challenge {
  id: string
  progress: number
  target_value: number
  status: string
  challenges: {
    title: string
    description: string
    challenge_type: string
    xp_reward: number
  } | null
}

interface WeeklyChallengesWidgetProps {
  challenges: Challenge[]
}

const TYPE_ICONS: Record<string, string> = {
  complete_sessions: '🎯',
  achieve_score:     '⭐',
  try_persona:       '👤',
  streak_maintain:   '🔥',
}

export function WeeklyChallengesWidget({ challenges }: WeeklyChallengesWidgetProps) {
  if (!challenges.length) {
    return (
      <Card className="border-border/50 bg-card/60">
        <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
            <Target className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Bu hafta için henüz bir görev atanmamış.
          </p>
        </CardContent>
      </Card>
    )
  }

  const completedCount = challenges.filter((c) => c.status === 'completed').length

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-xl shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-500" />
            Haftalık Görevler
          </CardTitle>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
            {completedCount} / {challenges.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenges.map((uc) => {
          const ch = uc.challenges
          if (!ch) return null
          const isCompleted = uc.status === 'completed'
          const percent = Math.min(100, Math.round((uc.progress / uc.target_value) * 100))
          const icon = TYPE_ICONS[ch.challenge_type] ?? '🎯'

          return (
            <div
              key={uc.id}
              className={cn(
                'group relative space-y-2 p-4 rounded-xl border transition-all duration-300',
                isCompleted
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-border/50 bg-surface-container-low hover:border-amber-500/30'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl flex-shrink-0 grayscale-[0.5] group-hover:grayscale-0 transition-all">
                    {icon}
                  </span>
                  <div className="space-y-0.5 min-w-0">
                    <p className={cn(
                      'text-sm font-bold truncate transition-colors',
                      isCompleted ? 'text-emerald-500/80' : 'text-foreground'
                    )}>
                      {ch.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate italic">
                      {ch.description}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] font-black text-amber-500">+{ch.xp_reward}</span>
                    <span className="text-[8px] font-bold text-amber-500/70">XP</span>
                  </div>
                  {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/60">
                  <span>İlerleme</span>
                  <span className="tabular-nums">
                    {uc.progress} / {uc.target_value}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-1000 ease-out',
                      isCompleted ? 'bg-emerald-500' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
