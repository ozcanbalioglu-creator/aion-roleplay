import type { DevelopmentPlan } from '@/lib/queries/development-plan.queries'
import { BookOpen, TrendingUp, TrendingDown, GraduationCap, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface DevelopmentPlanWidgetProps {
  plan: DevelopmentPlan | null
  compact?: boolean
}

function daysLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
}

export function DevelopmentPlanWidget({ plan, compact = false }: DevelopmentPlanWidgetProps) {
  if (!plan) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Gelişim Yolculuğunuz
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Gelişim planınız seanslar tamamlandıkça otomatik oluşturulur. En az 1 seans tamamlayın.
          </p>
        </CardContent>
      </Card>
    )
  }

  const remaining = daysLeft(plan.expiresAt)
  const isStale = remaining <= 7

  const training = plan.trainingRecommendations[0]
  const book = plan.bookRecommendations[0]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Gelişim Yolculuğunuz
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge
              variant="outline"
              className="text-[10px]"
            >
              {plan.sessionsConsidered} seans
            </Badge>
            {isStale && (
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                {remaining}g kaldı
              </Badge>
            )}
          </div>
        </div>
        {plan.coachNote && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed italic">
            &ldquo;{plan.coachNote}&rdquo;
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Güçlü Yanlar */}
        {plan.topStrengths.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              Güçlü Yanlar
            </p>
            <ul className="space-y-0.5">
              {(compact ? plan.topStrengths.slice(0, 2) : plan.topStrengths).map((s, i) => (
                <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                  <span className="text-green-500 mt-0.5">·</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gelişim Alanları */}
        {plan.priorityDevelopmentAreas.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-amber-500" />
              Öncelikli Gelişim
            </p>
            <ul className="space-y-0.5">
              {(compact ? plan.priorityDevelopmentAreas.slice(0, 2) : plan.priorityDevelopmentAreas).map(
                (a, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">·</span>
                    {a}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {/* Eğitim + Kitap (compact modda sadece birer tane) */}
        <div className="grid grid-cols-1 gap-3 pt-1">
          {training && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <GraduationCap className="h-3 w-3 text-blue-500" />
                Önerilen Eğitim
              </p>
              <p className="text-xs font-medium">{training.topic}</p>
              <p className="text-[10px] text-muted-foreground">{training.reason}</p>
              <Badge variant="outline" className="text-[10px]">
                {training.format}
              </Badge>
            </div>
          )}

          {!compact && book && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-purple-500" />
                Önerilen Kitap
              </p>
              <p className="text-xs font-medium">{book.title}</p>
              <p className="text-[10px] text-muted-foreground">{book.author}</p>
              <p className="text-[10px] text-muted-foreground">{book.reason}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
