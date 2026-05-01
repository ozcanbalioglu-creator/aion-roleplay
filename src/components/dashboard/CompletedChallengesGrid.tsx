import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target } from 'lucide-react'
import { AwardCard } from './AwardCard'

interface CompletedChallenge {
  id: string
  completed_at?: string | null
  challenges?: {
    title?: string
    description?: string
    challenge_type?: string
    xp_reward?: number
  } | Array<{ title?: string; description?: string; challenge_type?: string; xp_reward?: number }> | null
}

interface CompletedChallengesGridProps {
  challenges: CompletedChallenge[]
}

const TYPE_ICON: Record<string, string> = {
  weekly: '🗓️',
  monthly: '📅',
  daily: '☀️',
  milestone: '🎯',
  streak: '🔥',
}

function challengeData(c: CompletedChallenge) {
  return Array.isArray(c.challenges) ? c.challenges[0] : c.challenges
}

export function CompletedChallengesGrid({ challenges }: CompletedChallengesGridProps) {
  return (
    <Card className="bg-surface-container-low border-border/40 min-h-[500px] shadow-sm">
      <CardHeader className="pb-2 border-b border-border/20 mb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-emerald-500" />
            Görev Tamamlamaları
          </CardTitle>
          <span className="text-[10px] font-black tabular-nums bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {challenges.length} Görev
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {challenges.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4 border-2 border-dashed border-border/30 rounded-3xl opacity-50">
            <Target className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground text-center">
              Henüz tamamlanmış görev yok.
              <br />
              Haftalık görevlerini bitirdikçe burası dolar!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {challenges.map(c => {
              const ch = challengeData(c)
              const icon = TYPE_ICON[ch?.challenge_type ?? ''] ?? '🎯'
              return (
                <AwardCard
                  key={c.id}
                  icon={icon}
                  name={ch?.title ?? 'Görev'}
                  description={ch?.description ?? ''}
                  date={c.completed_at ?? null}
                  xpReward={ch?.xp_reward}
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
