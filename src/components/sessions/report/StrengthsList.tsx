import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react'

interface StrengthsListProps {
  strengths: string[]
  developmentAreas: string[]
}

export function StrengthsList({ strengths, developmentAreas }: StrengthsListProps) {
  return (
    <div className="bg-primary-container text-surface p-12 rounded-2xl relative overflow-hidden mb-24 shadow-lg shadow-primary-container/10">
      <div className="absolute top-0 right-0 w-64 h-64 bg-on-primary-container opacity-20 blur-[100px] -mr-32 -mt-32"></div>
      <div className="relative z-10">
        <h3 className="font-label text-xs uppercase tracking-[0.3em] font-bold text-on-primary-container mb-12">
          Micro-Coaching Insights
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Strengths */}
          <div className="space-y-6">
            <h4 className="flex items-center gap-2 font-headline italic text-2xl mb-6">
              <CheckCircle2 className="text-emerald-400 w-6 h-6" />
              Strengths
            </h4>
            {strengths.map((str, idx) => (
              <div key={idx} className="bg-surface-container-lowest/10 backdrop-blur-xl border border-white/5 p-6 rounded-xl">
                <p className="text-sm text-surface opacity-90 leading-relaxed">{str}</p>
              </div>
            ))}
            {strengths.length === 0 && (
              <div className="text-surface/50 text-sm italic">Belirtilmiş güçlü yan bulunamadı.</div>
            )}
          </div>

          {/* Development Areas */}
          <div className="space-y-6">
            <h4 className="flex items-center gap-2 font-headline italic text-2xl mb-6">
              <Lightbulb className="text-amber-400 w-6 h-6" />
              Development Areas
            </h4>
            {developmentAreas.map((dev, idx) => (
              <div key={idx} className="bg-surface-container-lowest/10 backdrop-blur-xl border border-white/5 p-6 rounded-xl">
                <p className="text-sm text-surface opacity-90 leading-relaxed">{dev}</p>
              </div>
            ))}
            {developmentAreas.length === 0 && (
              <div className="text-surface/50 text-sm italic">Belirtilmiş gelişim alanı bulunamadı.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
