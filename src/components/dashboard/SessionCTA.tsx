import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PlayIcon, ArrowRightIcon, SparklesIcon } from 'lucide-react'
import Link from 'next/link'

interface SessionCTAProps {
  activeSession: { id: string; personas: any; scenarios: any } | null
  topPersona: { id: string; name: string; title: string; recommendation_tag: string } | null
  completedThisWeek: number
}

export function SessionCTA({ activeSession, topPersona, completedThisWeek }: SessionCTAProps) {
  // Aktif seans varsa devam et kartı
  if (activeSession) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold">Devam Eden Seans</p>
            <p className="text-xs text-muted-foreground">
              {activeSession.personas?.name} — {activeSession.scenarios?.title}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href={`/dashboard/sessions/${activeSession.id}`}>
              <PlayIcon className="mr-1.5 h-3.5 w-3.5" />
              Devam Et
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Öneri kartı
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">
              {completedThisWeek === 0
                ? 'Bu hafta seans başlatmadınız'
                : 'Yeni seans başlatın'}
            </p>
            {topPersona && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Öneri:{' '}
                <span className="font-medium text-foreground">{topPersona.name}</span>
                {' '}— {topPersona.title}
              </p>
            )}
          </div>
          {topPersona?.recommendation_tag === 'never_tried' && (
            <SparklesIcon className="h-5 w-5 text-indigo-500" />
          )}
        </div>
        <div className="flex gap-2">
          {topPersona && (
            <Button asChild size="sm" variant="default">
              <Link href={`/dashboard/sessions/new?persona=${topPersona.id}`}>
                <PlayIcon className="mr-1.5 h-3.5 w-3.5" />
                {topPersona.name} ile Başlat
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/sessions/new">
              <ArrowRightIcon className="mr-1.5 h-3.5 w-3.5" />
              Tüm Personalar
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
