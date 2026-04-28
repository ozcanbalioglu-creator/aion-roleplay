'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ClockIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const DIFFICULTY_LABELS = ['', 'Başlangıç', 'Temel', 'Orta', 'İleri', 'Uzman']

const DIFFICULTY_DOTS = [
  '',
  'bg-emerald-400',
  'bg-teal-400',
  'bg-blue-400',
  'bg-orange-400',
  'bg-red-400',
]

const EMOTIONAL_LABELS: Record<string, string> = {
  positive: 'Pozitif', neutral: 'Nötr', negative: 'Negatif', volatile: 'Değişken',
}

interface ScenarioSelectionStepProps {
  persona: any
  scenarios: any[]
}

export function ScenarioSelectionStep({ persona, scenarios }: ScenarioSelectionStepProps) {
  const router = useRouter()

  const handleSelect = (scenarioId: string) => {
    router.push(`/dashboard/sessions/new?persona=${persona.id}&scenario=${scenarioId}`)
  }

  const handleBack = () => {
    router.push('/dashboard/sessions/new')
  }

  const initials = persona.name
    ?.split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('') ?? '?'

  const coachingTip =
    (persona.coaching_tips as string[] | null)?.find(Boolean) ??
    (persona.coaching_context as string | null)?.slice(0, 180) ??
    null

  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/20 shadow-2xl flex min-h-[620px]">

      {/* ── Left: Cinematic persona panel ── */}
      <div
        className="relative flex w-[300px] flex-shrink-0 flex-col items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #12112a 60%, #1e0040 100%)' }}
      >
        {/* Purple radial glow */}
        <div
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(157,107,223,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-5 left-5 flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors z-10"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Geri
        </button>

        {/* Persona photo */}
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div
            className="w-36 h-36 rounded-full overflow-hidden flex-shrink-0 bg-[#0d0c1d]"
            style={{ boxShadow: '0 0 48px rgba(157,107,223,0.2)' }}
          >
            {persona.avatar_image_url ? (
              <Image
                src={persona.avatar_image_url}
                alt={persona.name}
                width={144}
                height={144}
                className="h-full w-full object-cover grayscale brightness-90 contrast-110"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-primary-container/30">
                <span className="text-3xl font-headline font-light text-on-primary-container">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Name + role */}
          <div className="text-center space-y-1 px-4">
            <h2 className="text-2xl font-headline italic font-light tracking-wide text-white/95">
              {persona.name}
            </h2>
            <p
              className="text-[10px] font-label font-bold uppercase tracking-[0.25em]"
              style={{ color: '#9d6bdf' }}
            >
              {persona.title}
              {persona.department ? ` · ${persona.department}` : ''}
            </p>
            {persona.emotional_baseline && (
              <span
                className="inline-block mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-label font-semibold uppercase tracking-wider"
                style={{
                  background: 'rgba(157,107,223,0.18)',
                  color: '#c4a0f5',
                  border: '1px solid rgba(157,107,223,0.25)',
                }}
              >
                {EMOTIONAL_LABELS[persona.emotional_baseline] ?? persona.emotional_baseline}
              </span>
            )}
          </div>

          {/* Subtle audio bars decoration */}
          <div className="flex items-end gap-[3px] h-8 mt-1 opacity-30">
            {[4, 7, 12, 10, 14, 8, 11, 5, 9, 13, 6, 10].map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full"
                style={{
                  height: `${h * 2}px`,
                  background: 'rgba(157,107,223,0.7)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Bottom coaching tip — frosted glass */}
        {coachingTip && (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 p-5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5"
                style={{ fontSize: '16px', color: '#9d6bdf' }}
              >
                lightbulb
              </span>
              <div>
                <p className="text-[9px] font-label font-bold uppercase tracking-[0.2em] mb-1.5 text-white/30">
                  Koçluk Notu
                </p>
                <p className="text-[11px] font-body leading-relaxed text-white/60 line-clamp-4">
                  {coachingTip}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Scenario list ── */}
      <div className="flex flex-1 flex-col bg-surface overflow-hidden">

        {/* Header */}
        <div className="px-8 py-6 border-b border-outline-variant/10">
          <p className="text-[10px] font-label font-bold uppercase tracking-[0.25em] text-on-surface/40 mb-0.5">
            Adım 2
          </p>
          <h3 className="text-xl font-headline font-light text-on-surface">
            Hangi senaryoyla <em className="italic">başlamak</em> istiyorsun?
          </h3>
        </div>

        {/* Scenario items */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
          {scenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <span
                className="material-symbols-outlined text-4xl mb-3"
                style={{ color: '#9d6bdf', opacity: 0.4 }}
              >
                folder_open
              </span>
              <p className="text-sm text-on-surface/50">
                Bu persona için tanımlı senaryo bulunmuyor.
              </p>
            </div>
          ) : (
            scenarios.map((scenario) => (
              <ScenarioRow
                key={scenario.id}
                scenario={scenario}
                personaName={persona.name}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Scenario row ─────────────────────────────────────────────────── */

function ScenarioRow({
  scenario,
  personaName,
  onSelect,
}: {
  scenario: any
  personaName: string
  onSelect: (id: string) => void
}) {
  const diffLevel = scenario.difficulty_level ?? 3

  return (
    <button
      onClick={() => onSelect(scenario.id)}
      className="w-full text-left px-8 py-6 hover:bg-primary/[0.04] transition-colors group flex items-start gap-6"
    >
      {/* Difficulty indicator strip */}
      <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0 w-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 w-1.5 rounded-full transition-opacity',
              i < diffLevel
                ? DIFFICULTY_DOTS[diffLevel] + ' opacity-100'
                : 'bg-on-surface/15'
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <h4 className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors leading-snug">
            {scenario.title}
          </h4>
          <div className="flex items-center gap-1 flex-shrink-0 text-on-surface/40 group-hover:text-primary transition-colors">
            <span className="text-xs font-label">{DIFFICULTY_LABELS[diffLevel]}</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Mood hint — persona's emotional state */}
        {scenario.mood_hint && (
          <p className="text-sm font-headline italic text-on-surface/55 leading-snug">
            &ldquo;{scenario.mood_hint}&rdquo;
          </p>
        )}

        {/* Description — narrative context */}
        {!scenario.mood_hint && scenario.description && (
          <p className="text-xs text-on-surface/50 line-clamp-2 leading-relaxed">
            {scenario.description}
          </p>
        )}
        {scenario.mood_hint && scenario.description && (
          <p className="text-xs text-on-surface/40 line-clamp-2 leading-relaxed">
            {scenario.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span className="flex items-center gap-1 text-[10px] text-on-surface/40">
            <ClockIcon className="h-3 w-3" />
            ~{scenario.estimated_duration_min} dk
          </span>
          {(scenario.target_skills as string[])?.slice(0, 3).map((skill: string, i: number) => (
            <span
              key={i}
              className="rounded-full px-2 py-px text-[10px] font-label font-medium"
              style={{
                background: 'rgba(42,0,86,0.07)',
                color: 'rgba(42,0,86,0.65)',
              }}
            >
              {skill.replace(/_/g, ' ')}
            </span>
          ))}
          {(scenario.target_skills as string[])?.length > 3 && (
            <span className="text-[10px] text-on-surface/30">
              +{(scenario.target_skills as string[]).length - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
