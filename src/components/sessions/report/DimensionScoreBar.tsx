'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface DimensionScoreBarProps {
  dimensionCode: string
  dimensionName?: string
  score: number
  evidence: string[]
  feedback: string
}

const DIMENSION_LABELS: Record<string, string> = {
  active_listening: 'Aktif Dinleme',
  powerful_questions: 'Güçlü Sorular',
  direct_communication: 'Doğrudan İletişim',
  creating_awareness: 'Farkındalık Yaratma',
  designing_actions: 'Aksiyon Tasarımı',
  managing_progress: 'İlerleme Yönetimi',
}

export function DimensionScoreBar({
  dimensionCode,
  dimensionName,
  score,
  evidence,
  feedback,
}: DimensionScoreBarProps) {
  const [expanded, setExpanded] = useState(false)
  const label = dimensionName ?? DIMENSION_LABELS[dimensionCode] ?? dimensionCode
  const percentage = (score / 5) * 100

  return (
    <div className="bg-surface-container-low p-8 rounded-2xl mb-6 shadow-sm border border-transparent hover:border-surface-container-highest transition-colors">
      <div 
        className="flex justify-between items-end mb-6 cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-1">
          <span className="font-label text-xs uppercase tracking-widest font-bold group-hover:text-on-primary-container transition-colors">
            {label}
          </span>
          <span className="text-on-surface-variant/40 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
            Details {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        </div>
        <span className="text-2xl font-headline italic">{percentage.toFixed(0)}%</span>
      </div>
      
      <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden mb-6">
        <div 
          className="h-full bg-gradient-to-r from-primary-container to-on-primary-container transition-all duration-1000" 
          style={{ width: `${percentage}%` }}
        />
      </div>

      {expanded && (
        <div className="pt-6 border-t border-surface-container-highest mt-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
          <div>
            <span className="font-label text-[10px] uppercase tracking-[0.2em] font-bold text-on-primary-container mb-4 block">Feedback Integration</span>
            <p className="text-sm text-on-background/80 leading-relaxed pl-4 border-l-2 border-on-primary-container/20">
              {feedback}
            </p>
          </div>
          
          {evidence && evidence.length > 0 && (
            <div>
              <span className="font-label text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant mb-4 block">Transcript Evidence</span>
              <div className="space-y-3">
                {evidence.map((ev, i) => (
                  <div key={i} className="p-4 rounded-lg bg-surface-container-highest/30 border-l-2 border-on-surface-variant/30">
                    <p className="text-on-background/70 leading-relaxed italic text-sm">&ldquo;{ev}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
