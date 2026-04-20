'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface RecentSession {
  id: string
  completed_at: string | null
  duration_seconds: number | null
  personas: { name: string; avatar_url?: string } | null
  scenarios: { title: string } | null
  evaluations: { overall_score: number }[] | null
}

interface RecentSessionsListProps {
  sessions: RecentSession[]
}

const scoreColor = (score: number) => {
  if (score >= 4.5) return 'text-emerald-500'
  if (score >= 3.5) return 'text-amber-500'
  if (score >= 2.5) return 'text-orange-500'
  return 'text-red-500'
}

export function RecentSessionsList({ sessions }: RecentSessionsListProps) {
  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Son Yansımalar
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-primary transition-colors">
            <Link href="/dashboard/sessions">Tümü</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {sessions.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto" />
            <p className="text-xs font-medium text-muted-foreground italic">
              Henüz tamamlanmış seans yok.
            </p>
          </div>
        ) : (
          sessions.map((s) => {
            const persona = s.personas
            const scenario = s.scenarios
            const score = s.evaluations?.[0]?.overall_score
            const dMin = s.duration_seconds ? Math.round(s.duration_seconds / 60) : null

            return (
              <Link
                key={s.id}
                href={`/dashboard/sessions/${s.id}/report`}
                className="flex items-center justify-between py-3 px-3 rounded-2xl hover:bg-surface-container-highest transition-all duration-300 group border border-transparent hover:border-border/40"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest border border-border/50 flex items-center justify-center text-amber-500 text-sm font-black flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                    {persona?.name?.[0] ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{persona?.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                      <span className="truncate max-w-[120px]">{scenario?.title}</span>
                      {dMin && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>{dMin} DK</span>
                        </>
                      )}
                      {s.completed_at && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="tabular-nums">
                            {new Date(s.completed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {score != null ? (
                    <div className="bg-surface-container-highest px-3 py-1 rounded-full border border-border/40">
                      <span className={cn('text-sm font-black tabular-nums', scoreColor(score))}>
                        {score.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
