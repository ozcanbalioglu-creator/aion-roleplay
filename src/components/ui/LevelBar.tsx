'use client'

import { cn } from '@/lib/utils'

const LEVEL_NAMES = ['', 'Giriş', 'Gelişen', 'Yetkin', 'Uzman', 'Efsane']

interface LevelBarProps {
  level: number
  progressPercent: number
  xpPoints: number
  nextLevelXP: number
  compact?: boolean
}

export function LevelBar({ level, progressPercent, xpPoints, nextLevelXP, compact }: LevelBarProps) {
  return (
    <div className={cn('space-y-1.5', compact ? 'px-1 py-1' : 'px-4 py-3')}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
          Sv.{level} — {LEVEL_NAMES[level] ?? 'Koç'}
        </span>
        {!compact && (
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
            {xpPoints} / {level >= 5 ? '∞' : nextLevelXP} XP
          </span>
        )}
      </div>
      <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-500 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(245,158,11,0.4)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {compact && (
        <div className="flex justify-between items-center text-[8px] text-muted-foreground/60 uppercase tracking-tighter">
          <span>{xpPoints} XP</span>
          <span>{level >= 5 ? 'MAX' : `${nextLevelXP} XP`}</span>
        </div>
      )}
    </div>
  )
}
