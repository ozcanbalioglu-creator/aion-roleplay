import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target } from 'lucide-react'

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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {challenges.map(c => {
              const ch = challengeData(c)
              const icon = TYPE_ICON[ch?.challenge_type ?? ''] ?? '🎯'
              return (
                <div
                  key={c.id}
                  className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border/40 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
                >
                  <div className="relative h-16 w-16 mb-2">
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-full w-full rounded-2xl bg-surface-container-low border border-border/40 flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110">
                      {icon}
                    </div>
                  </div>
                  <div className="text-center space-y-0.5">
                    <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">
                      {ch?.title ?? 'Görev'}
                    </p>
                    <p className="text-[9px] text-muted-foreground line-clamp-2 italic px-1 h-6">
                      {ch?.description ?? ''}
                    </p>
                  </div>
                  {typeof ch?.xp_reward === 'number' && (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 tabular-nums">
                      +{ch.xp_reward} DP
                    </span>
                  )}
                  <div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-muted-foreground/40 border-t border-border/20 pt-2 w-full text-center">
                    {c.completed_at
                      ? new Date(c.completed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
                      : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
