'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUpDown, ChevronRight, Minus, TrendingDown, TrendingUp, Users } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  sessionCount: number
  avgScore: number | null
  lastSessionAt: string | null
  trend: 'up' | 'down' | 'stable' | null
  xpPoints: number
  level: number
}

interface TeamMemberTableProps {
  members: TeamMember[]
}

type SortKey = 'name' | 'sessionCount' | 'avgScore' | 'lastSessionAt'

const SCORE_COLOR = (score: number) => {
  if (score >= 4.5) return 'text-emerald-400'
  if (score >= 3.5) return 'text-amber-400'
  if (score >= 2.5) return 'text-orange-400'
  return 'text-red-400'
}

const TREND_ICON = {
  up: <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />,
  down: <TrendingDown className="h-3.5 w-3.5 text-red-400" />,
  stable: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
}

function SortHeader({
  col,
  label,
  onSort,
}: {
  col: SortKey
  label: string
  onSort: (key: SortKey) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )
}

export function TeamMemberTable({ members }: TeamMemberTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('avgScore')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = [...members].sort((a, b) => {
    let av: number | string | null
    let bv: number | string | null

    if (sortKey === 'name') {
      av = a.name
      bv = b.name
    } else if (sortKey === 'sessionCount') {
      av = a.sessionCount
      bv = b.sessionCount
    } else if (sortKey === 'avgScore') {
      av = a.avgScore ?? -1
      bv = b.avgScore ?? -1
    } else {
      av = a.lastSessionAt ?? ''
      bv = b.lastSessionAt ?? ''
    }

    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortAsc ? cmp : -cmp
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((value) => !value)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  if (!members.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Takımınızda henüz kullanıcı yok.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Takım Üyeleri ({members.length})
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleSort('avgScore')}>
            Skora göre sırala
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-muted/30">
            <SortHeader col="name" label="İsim" onSort={toggleSort} />
            <SortHeader col="sessionCount" label="Seans" onSort={toggleSort} />
            <SortHeader col="avgScore" label="Ort. Puan" onSort={toggleSort} />
            <SortHeader col="lastSessionAt" label="Son Seans" onSort={toggleSort} />
            <span className="w-8" />
          </div>

          <div className="divide-y divide-border">
            {sorted.map((member) => (
              <Link
                key={member.id}
                href={`/reports/users/${member.id}`}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 hover:bg-muted/30 transition-colors items-center group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                    {member.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>

                <span className="text-sm tabular-nums">{member.sessionCount}</span>

                <div className="flex items-center gap-1.5">
                  {member.avgScore != null ? (
                    <>
                      <span className={cn('text-sm font-semibold tabular-nums', SCORE_COLOR(member.avgScore))}>
                        {member.avgScore.toFixed(1)}
                      </span>
                      {member.trend && TREND_ICON[member.trend]}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </div>

                <span className="text-xs text-muted-foreground">
                  {member.lastSessionAt
                    ? new Date(member.lastSessionAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
                    : '-'}
                </span>

                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
