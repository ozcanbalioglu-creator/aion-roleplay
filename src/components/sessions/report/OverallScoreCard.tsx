import { cn } from '@/lib/utils'

interface OverallScoreCardProps {
  overallScore: number
  personaName: string
  scenarioTitle: string
  durationSeconds: number | null
  messageCount?: number
  completedAt: string | null
}

const formatScore = (score: number) => {
  return ((score / 5) * 100).toFixed(0) + '%'
}

export function OverallScoreCard({
  overallScore,
  personaName,
  scenarioTitle,
  durationSeconds,
  completedAt,
}: OverallScoreCardProps) {
  const durationMin = durationSeconds ? Math.round(durationSeconds / 60) : null
  const formattedDate = completedAt
    ? new Date(completedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Unknown Date'

  return (
    <header className="mb-20">
      <div className="text-on-primary-container font-label text-[0.75rem] uppercase tracking-[0.2em] font-bold mb-4">
        Session Report — {formattedDate}
      </div>
      <h1 className="text-4xl lg:text-5xl font-headline font-normal leading-tight text-on-background mb-8">
        Your reflection on <span className="serif-italic">{scenarioTitle}</span> with {personaName}.
        {durationMin && <span className="block text-xl opacity-60 mt-4 tracking-widest font-label uppercase">Duration: {durationMin} min</span>}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
        <div className="bg-surface-container-low p-8 rounded-2xl shadow-sm">
          <div className="flex justify-between items-end mb-6">
            <span className="font-label text-xs uppercase tracking-widest font-bold">Overall Sync Quality</span>
            <span className="text-2xl font-headline italic">{formatScore(overallScore)}</span>
          </div>
          <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div 
               className="h-full bg-gradient-to-r from-primary-container to-on-primary-container transition-all duration-1000"
               style={{ width: `${(overallScore / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
