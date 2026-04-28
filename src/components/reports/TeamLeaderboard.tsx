import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  id: string
  name: string
  avgScore: number | null
  sessionCount: number
  xpPoints: number
}

interface TeamLeaderboardProps {
  entries: LeaderboardEntry[]
  anonymous?: boolean
  sortBy?: 'score' | 'xp' | 'sessions'
}

const RANK_STYLES = [
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-zinc-400/20 text-zinc-400 border-zinc-400/30',
  'bg-orange-600/20 text-orange-500 border-orange-600/30',
]

const RANK_ICONS = ['1', '2', '3']

export function TeamLeaderboard({ entries, anonymous = false, sortBy = 'score' }: TeamLeaderboardProps) {
  if (!entries.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Bu dönemde tamamlanmış seans yok.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          Sıralama
          {anonymous && (
            <span className="text-[10px] font-normal bg-muted px-1.5 py-0.5 rounded">Anonim</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.slice(0, 10).map((entry) => {
          const rankStyle = RANK_STYLES[entry.rank - 1]
          const displayName = anonymous ? `Kullanıcı #${entry.rank}` : entry.name

          return (
            <div
              key={entry.id}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-lg',
                entry.rank <= 3 ? 'bg-muted/40' : 'hover:bg-muted/20'
              )}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0',
                  rankStyle ?? 'bg-muted/30 text-muted-foreground border-border'
                )}
              >
                {entry.rank <= 3 ? RANK_ICONS[entry.rank - 1] : entry.rank}
              </div>

              <span className="flex-1 text-sm font-medium truncate">{displayName}</span>

              <div className="text-right flex-shrink-0">
                {sortBy === 'score' && entry.avgScore != null && (
                  <span className="text-sm font-bold text-amber-400">{entry.avgScore.toFixed(1)}</span>
                )}
                {sortBy === 'xp' && (
                  <span className="text-sm font-bold text-amber-400">{entry.xpPoints} XP</span>
                )}
                {sortBy === 'sessions' && (
                  <span className="text-sm font-bold text-primary">{entry.sessionCount}</span>
                )}
                <p className="text-[10px] text-muted-foreground">{entry.sessionCount} seans</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
