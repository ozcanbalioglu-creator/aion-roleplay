'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowRightIcon, PlayIcon, FileTextIcon, Clock, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { SessionStatusBadge } from './SessionStatusBadge'

interface SessionPersona {
  id: string
  name: string
  title: string
  personality_type: string
}

interface SessionScenario {
  id: string
  title: string
  difficulty_level: number
}

interface SessionEvaluation {
  overall_score: number | null
}

type RelatedOrNull<T> = T | T[] | null | undefined

interface Session {
  id: string
  status: 'pending' | 'active' | 'debrief_active' | 'debrief_completed' | 'completed' | 'evaluation_failed' | 'cancelled' | 'dropped' | 'failed'
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  cancelled_at: string | null
  cancellation_reason: string | null
  // Supabase returns related rows as object (FK) or array (reverse FK) or null
  personas: RelatedOrNull<SessionPersona>
  scenarios: RelatedOrNull<SessionScenario>
  evaluations: RelatedOrNull<SessionEvaluation>
}

interface SessionListProps {
  sessions: Session[]
}

/** Supabase bazen ilişkili satırı obje, bazen array döner; bunu normalize eder */
function first<T>(val: RelatedOrNull<T>): T | null {
  if (val === null || val === undefined) return null
  if (Array.isArray(val)) return val[0] ?? null
  return val
}


// Index 0 unused (difficulty_level 1-5). Fallback: invalid değer için "Belirsiz".
const DIFFICULTY_LABELS = ['Belirsiz', 'Başlangıç', 'Temel', 'Orta', 'İleri', 'Uzman']

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-'
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes > 0) {
    return `${minutes} dk ${secs > 0 ? `${secs} sn` : ''}`.trim()
  }
  return `${secs} sn`
}

export function SessionList({ sessions }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Henüz seans yok.</p>
            <Button asChild>
              <Link href="/dashboard/sessions/new">
                <ArrowRightIcon className="mr-1.5 h-3.5 w-3.5" />
                İlk Seansını Başlat
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead>Senaryo</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Süre</TableHead>
            <TableHead>Skor</TableHead>
            <TableHead>Tarih</TableHead>
            <TableHead className="text-right">Aksiyon</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => {
            const persona = first(session.personas)
            const scenario = first(session.scenarios)
            const evaluation = first(session.evaluations)

            return (
              <TableRow key={session.id}>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{persona?.name ?? '-'}</p>
                    <p className="text-xs text-muted-foreground">{persona?.title ?? ''}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="text-sm">{scenario?.title ?? '-'}</p>
                    {scenario && (
                      <Badge
                        variant="outline"
                        className="text-xs border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300"
                      >
                        {DIFFICULTY_LABELS[scenario.difficulty_level] || 'Belirsiz'}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <SessionStatusBadge status={session.status} className="text-[10px]" />
                </TableCell>
                <TableCell className="text-sm">
                  {formatDuration(session.duration_seconds)}
                </TableCell>
                <TableCell className="text-sm">
                  {evaluation && evaluation.overall_score !== null ? (
                    <span className="text-sm font-semibold text-amber-400 tabular-nums">
                      {evaluation.overall_score.toFixed(1)}
                      <span className="text-xs text-muted-foreground font-normal">/5</span>
                    </span>
                  ) : ['completed', 'debrief_completed'].includes(session.status) ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 animate-pulse" />
                      Değerlendiriliyor
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {session.completed_at
                    ? new Date(session.completed_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : session.started_at
                      ? new Date(session.started_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {/* Rapor görüntülenebilir durumlar: completed (legacy), debrief_completed
                      (yeni akış), evaluation_failed (rapor sayfasında retry butonu var) */}
                  {['completed', 'debrief_completed', 'evaluation_failed'].includes(session.status) ? (
                    <Button asChild variant="ghost" size="sm" className="hover:bg-amber-500/10 text-amber-500">
                      <Link href={`/dashboard/sessions/${session.id}/report`}>
                        <FileTextIcon className="mr-1.5 h-3.5 w-3.5" />
                        Rapor
                      </Link>
                    </Button>
                  ) : ['active', 'dropped'].includes(session.status) ? (
                    <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 text-primary">
                      <Link href={`/dashboard/sessions/${session.id}`}>
                        <PlayIcon className="mr-1.5 h-3.5 w-3.5" />
                        {session.status === 'dropped' ? 'Devam Et' : 'Katıl'}
                        <ChevronRightIcon className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  ) : session.status === 'debrief_active' ? (
                    /* Debrief yarıda kalmış — kullanıcı seansa dönerse page.tsx
                       DebriefSessionClient'a yönlendirir (page.tsx:53) */
                    <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 text-primary">
                      <Link href={`/dashboard/sessions/${session.id}`}>
                        <PlayIcon className="mr-1.5 h-3.5 w-3.5" />
                        Geri Bildirime Dön
                        <ChevronRightIcon className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs italic opacity-50">-</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
