import type { CancellationStats } from '@/lib/queries/cancellation.queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { XCircle } from 'lucide-react'

interface CancellationStatsWidgetProps {
  stats: CancellationStats | null
}

const REASON_COLORS: Record<string, string> = {
  technical_issue: 'text-destructive border-destructive/30',
  persona_wrong_fit: 'text-amber-500 border-amber-500/30',
  scenario_too_hard: 'text-sky-500 border-sky-500/30',
  user_interrupted: 'text-muted-foreground border-border',
  manual_cancel: 'text-muted-foreground border-border',
  drop_off: 'text-muted-foreground border-border',
  technical_failure: 'text-destructive border-destructive/30',
}

export function CancellationStatsWidget({ stats }: CancellationStatsWidgetProps) {
  if (!stats || stats.totalCancelled === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <XCircle className="h-4 w-4 text-muted-foreground" />
          Yarıda Bırakılan Seanslar
          <Badge variant="outline" className="text-[10px] ml-auto">
            {stats.totalCancelled} seans
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Per-persona breakdown */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Persona Bazlı
          </p>
          <div className="space-y-2">
            {stats.byPersona.map((p) => (
              <div key={p.personaId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate">{p.personaName}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {p.cancelled}/{p.total} · %{p.rate}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-destructive/50 transition-all"
                    style={{ width: `${p.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reason breakdown */}
        {stats.byReason.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sebep Dağılımı
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stats.byReason.map((r) => (
                <Badge
                  key={r.reason}
                  variant="outline"
                  className={`text-[10px] ${REASON_COLORS[r.reason] ?? 'text-muted-foreground border-border'}`}
                >
                  {r.label} · {r.count}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
