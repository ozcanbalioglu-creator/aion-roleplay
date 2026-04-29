import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getSessionReport, getPersonaScoreHistory } from '@/lib/queries/evaluation.queries'
import { getSessionMessageCount } from '@/lib/queries/session.queries'
import { OverallScoreCard } from '@/components/sessions/report/OverallScoreCard'
import { DimensionScoreBar } from '@/components/sessions/report/DimensionScoreBar'
import { StrengthsList } from '@/components/sessions/report/StrengthsList'
import { CoachingNote } from '@/components/sessions/report/CoachingNote'
import { ReportAudioPlayer } from '@/components/sessions/report/ReportAudioPlayer'
import { RetryEvaluationButton } from '@/components/sessions/report/RetryEvaluationButton'
import { Button } from '@/components/ui/button'
import { RefreshCw, ArrowLeft, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

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

  const [scoreHistory, messageCount] = await Promise.all([
    report.persona?.id
      ? getPersonaScoreHistory(currentUser.id, report.persona.id)
      : Promise.resolve([]),
    getSessionMessageCount(id),
  ])

  const evaluation = report.evaluation
  const dimensionScores = evaluation?.dimension_scores ?? []

  return (
    <div className="flex flex-col xl:flex-row flex-1 overflow-hidden h-full bg-background min-h-screen">
      <div className="flex-1 overflow-y-auto w-full p-8 md:p-12 lg:p-20">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Üst navigasyon */}
          <div className="flex items-center gap-4 mb-8">
            <Link 
              href="/dashboard/sessions"
              className="font-label text-xs uppercase tracking-widest font-bold text-on-surface-variant hover:text-on-primary-container transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> To Sessions
            </Link>
          </div>

          {evaluation?.status === 'evaluation_failed' ? (
            /* Kalıcı hata durumu */
            <div className="py-24 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center mb-8">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="font-headline text-3xl italic mb-4">Değerlendirme Başarısız Oldu</h2>
              <p className="text-on-surface-variant leading-relaxed mb-8">
                AI değerlendirme motoru bu seans için birkaç deneme yaptı ancak sonuç üretemedi. Tekrar denemek için aşağıdaki butonu kullanabilirsin.
              </p>
              <RetryEvaluationButton sessionId={id} />
            </div>
          ) : evaluation ? (
            <>
              {/* Sesli Rapor Player */}
              <ReportAudioPlayer sessionId={id} />

              {/* Genel Puan Başlığı / Narrative Header */}
              <OverallScoreCard
                overallScore={evaluation.overall_score}
                personaName={report.persona?.name ?? 'Ekip Üyesi'}
                scenarioTitle={report.scenario?.title ?? 'Session'}
                durationSeconds={report.session.duration_seconds}
                messageCount={messageCount}
                completedAt={report.session.completed_at}
              />

              {/* Boyut Analizi */}
              {dimensionScores.length > 0 && (
                <div className="mb-24">
                  <h3 className="font-label text-xs uppercase tracking-[0.2em] font-bold text-on-surface-variant mb-6">Competency Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(dimensionScores as Array<{ dimension_code: string; score: number; evidence_quotes?: string[]; improvement_tip?: string; rationale?: string }>).map((d) => (
                      <DimensionScoreBar
                        key={d.dimension_code}
                        dimensionCode={d.dimension_code}
                        score={d.score}
                        evidence={d.evidence_quotes ?? []}
                        feedback={d.improvement_tip ?? d.rationale ?? ''}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Güçlü Yanlar ve Gelişim */}
              <StrengthsList
                strengths={evaluation.strengths ?? []}
                developmentAreas={evaluation.development_areas ?? []}
              />

            </>
          ) : (
            /* Değerlendirme henüz hazır değil - Stitch Stili Yükleme */
            <div className="py-24 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <div className="h-24 w-24 rounded-full bg-surface-container-highest/50 flex items-center justify-center mb-8 relative">
                <Clock className="h-10 w-10 text-on-primary-container animate-spin duration-3000" />
                <div className="absolute inset-0 border border-on-primary-container/30 rounded-full animate-ping blur-sm"></div>
              </div>
              <h2 className="font-headline text-3xl italic mb-4">Değerlendirme Hazırlanıyor</h2>
              <p className="text-on-surface-variant leading-relaxed mb-8">
                AI değerlendirme motoru seansınızı ICF rubric boyutlarına göre analiz ediyor. &ldquo;No-Line&rdquo; yapısına geçerken sabrınız için teşekkürler. Lütfen birkaç dakika bekleyin.
              </p>
              <Button asChild className="rounded-full bg-primary-container text-on-primary hover:bg-on-primary-container transition-colors px-8 py-6 h-auto">
                <Link href={`/dashboard/sessions/${id}/report`} className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Güncelle Durumu Öğren
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Sağ Panel Yansıma ve Koçluk Notu (Eğer rapor hazırsa gösterilir) */}
      {evaluation && (
        <CoachingNote
          coachingNote={evaluation.coaching_note ?? ''}
          managerInsight={evaluation.manager_insight ?? ''}
        />
      )}
    </div>
  )
}
