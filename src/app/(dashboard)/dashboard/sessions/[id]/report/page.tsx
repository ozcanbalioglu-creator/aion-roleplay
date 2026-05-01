import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getSessionReport, getPersonaScoreHistory } from '@/lib/queries/evaluation.queries'
import { Button } from '@/components/ui/button'
import { ReportAudioPlayer } from '@/components/sessions/report/ReportAudioPlayer'
import { RetryEvaluationButton } from '@/components/sessions/report/RetryEvaluationButton'
import { ReportHero } from '@/components/sessions/report/ReportHero'
import { DimensionCardList } from '@/components/sessions/report/DimensionCardList'
import { ReflectionSection } from '@/components/sessions/report/ReflectionSection'
import {
  computeOverallAverage,
  formatDuration,
  normalizeDimensions,
  type DimensionScoreRow,
} from '@/components/sessions/report/report-utils'
import styles from '@/components/sessions/report/report.module.css'

// Değerlendirme kuyruğa alındıktan sonra tamamlanması 1-2 dakika alır.
// getCurrentUser() cookies kullandığı için bu sayfa statik üretilemez.
export const dynamic = 'force-dynamic'

interface ReportPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionReportPage({ params }: ReportPageProps) {
  const { id } = await params
  const currentUser = await getCurrentUser()
  if (!currentUser) notFound()

  const report = await getSessionReport(id)
  if (!report) {
    console.error('[ReportPage] getSessionReport returned null', {
      sessionId: id,
      userId: currentUser.id,
    })
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-5rem)] gap-6 px-4 text-center">
        <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-semibold">Rapor Hazırlanıyor veya Erişilemiyor</h2>
          <p className="text-sm text-muted-foreground">
            Bu seans için rapor henüz oluşmamış olabilir veya bir okuma hatası oldu. Birkaç saniye
            sonra tekrar dene; sorun sürerse oturumlar listesinden seansa yeniden gir.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard/sessions">Oturumlara Dön</Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/sessions/${id}/report`}>
              <RefreshCw className="h-4 w-4 mr-2" /> Tekrar Dene
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // Seans tamamlanmamışsa aktif seans sayfasına yönlendir
  if (report.session.status === 'active' || report.session.status === 'pending') {
    redirect(`/dashboard/sessions/${id}`)
  }

  const evaluation = report.evaluation

  // Failed durumu — yeniden tetikle butonu
  if (evaluation?.status === 'evaluation_failed') {
    return (
      <div className={styles.scope}>
        <BackBar sessionId={id} />
        <div className={styles.page}>
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center mb-8">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="font-headline text-3xl italic mb-4">Değerlendirme Başarısız Oldu</h2>
            <p className="text-on-surface-variant leading-relaxed mb-8">
              AI değerlendirme motoru bu seans için birkaç deneme yaptı ancak sonuç üretemedi.
              Tekrar denemek için aşağıdaki butonu kullanabilirsin.
            </p>
            <RetryEvaluationButton sessionId={id} />
          </div>
        </div>
      </div>
    )
  }

  // Pending — değerlendirme bekleniyor
  if (!evaluation) {
    return (
      <div className={styles.scope}>
        <BackBar sessionId={id} />
        <div className={styles.page}>
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="h-24 w-24 rounded-full bg-surface-container-highest/50 flex items-center justify-center mb-8 relative">
              <Clock className="h-10 w-10 text-on-primary-container animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-0 border border-on-primary-container/30 rounded-full animate-ping blur-sm" />
            </div>
            <h2 className="font-headline text-3xl italic mb-4">Değerlendirme Hazırlanıyor</h2>
            <p className="text-on-surface-variant leading-relaxed mb-8">
              AI değerlendirme motoru seansınızı ICF rubric boyutlarına göre analiz ediyor. Lütfen
              birkaç dakika bekleyin. Eğer 2 dakikadan fazla beklediyseniz aşağıdaki &ldquo;Yeniden
              Dene&rdquo; butonuna basın.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline" className="rounded-full px-6 py-6 h-auto">
                <Link href={`/dashboard/sessions/${id}/report`} className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Sayfayı Yenile
                </Link>
              </Button>
              <RetryEvaluationButton sessionId={id} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Hazır rapor — yeni layered tasarım ──

  const dimensionScores = (evaluation.dimension_scores ?? []) as DimensionScoreRow[]
  const dimensions = normalizeDimensions(dimensionScores)
  const overallAvg = computeOverallAverage(dimensions, Number(evaluation.overall_score) || 0)

  // Hero için meta bilgi
  const formattedDate = report.session.completed_at
    ? new Date(report.session.completed_at).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Tarih belirsiz'
  const durationLabel = formatDuration(report.session.duration_seconds)
  const personaName = report.persona?.name ?? 'Ekip Üyesi'
  const scenarioTitle = report.scenario?.title ?? 'Seans'

  // Hero narrative — coaching_note ilk öncelikli, manager_insight fallback
  const narrative =
    (evaluation.coaching_note ?? evaluation.manager_insight ?? '').trim() ||
    `Bu seansda ${dimensions.length} koçluk boyutu değerlendirildi.`

  // Trend (aynı persona ile geçmiş seans skorları)
  const trend = report.persona?.id
    ? await getPersonaScoreHistory(currentUser.id, report.persona.id)
    : []

  return (
    <div className={styles.scope}>
      <BackBar sessionId={id} personaName={personaName} scenarioTitle={scenarioTitle} />

      <div className={styles.page}>
        {/* Sesli Rapor — küçük, hero üstünde */}
        <div style={{ marginBottom: '1rem' }}>
          <ReportAudioPlayer sessionId={id} />
        </div>

        {/* Layer 1: Hero */}
        <ReportHero
          overallAverage={overallAvg}
          personaName={personaName}
          scenarioTitle={scenarioTitle}
          formattedDate={formattedDate}
          durationLabel={durationLabel}
          narrative={narrative}
          dimensions={dimensions}
        />

        {/* Layer 2 + 3 + 4 birlikte (interaktif scroll için) */}
        <DimensionCardList dimensions={dimensions} overallAverage={overallAvg} />

        {/* Layer 5: Yansıma — coaching_note Hero'da kullanılıyor, burada sadece
            manager_insight + trend (2 kolon) */}
        <ReflectionSection
          managerInsight={evaluation.manager_insight ?? ''}
          trend={trend}
        />
      </div>
    </div>
  )
}

/**
 * "Seanslarım"'a dön linki + opsiyonel başlık.
 * Dashboard layout zaten AppHeader ve AppSidebar sağlıyor — bu sadece sayfa
 * içi context çubuğu.
 */
function BackBar({
  sessionId,
  personaName,
  scenarioTitle,
}: {
  sessionId: string
  personaName?: string
  scenarioTitle?: string
}) {
  void sessionId
  return (
    <div className={styles.inlineBar}>
      <Link href="/dashboard/sessions" className={styles.backLink}>
        <ArrowLeft className="w-4 h-4" />
        Seanslarım
      </Link>
      {personaName && scenarioTitle && (
        <div
          className={styles.serif}
          style={{ fontSize: '0.95rem', color: 'var(--rep-muted, #6B6880)' }}
        >
          <em style={{ color: '#9D6BDF', fontStyle: 'italic' }}>{personaName}</em> · {scenarioTitle}
        </div>
      )}
    </div>
  )
}
