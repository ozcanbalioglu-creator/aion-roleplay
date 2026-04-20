'use client'

import { cn } from '@/lib/utils'
import type { SessionPhase } from '@/stores/session.store'

const PHASES: { key: SessionPhase; label: string }[] = [
  { key: 'opening', label: 'Açılış' },
  { key: 'exploration', label: 'Keşif' },
  { key: 'deepening', label: 'Derinleştirme' },
  { key: 'action', label: 'Aksiyon' },
  { key: 'closing', label: 'Kapanış' },
]

interface PhaseIndicatorProps {
  currentPhase: SessionPhase
}

export function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const currentIndex = PHASES.findIndex((p) => p.key === currentPhase)

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={phase.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  isCompleted && 'bg-amber-500',
                  isCurrent && 'bg-amber-400 ring-2 ring-amber-400/30 w-2.5 h-2.5',
                  !isCompleted && !isCurrent && 'bg-muted-foreground/30'
                )}
              />
              <span
                className={cn(
                  'text-[9px] hidden sm:block',
                  isCurrent ? 'text-amber-400 font-medium' : 'text-muted-foreground/50'
                )}
              >
                {phase.label}
              </span>
            </div>
            {index < PHASES.length - 1 && (
              <div
                className={cn(
                  'h-px w-4 sm:w-8 mb-3 transition-all duration-300',
                  isCompleted ? 'bg-amber-500' : 'bg-muted-foreground/20'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
