'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Loader2Icon,
  PlayIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSessionAction } from '@/lib/actions/session.actions'
import { toast } from '@/lib/toast'
import { PersonaInfoColumn } from './PersonaInfoColumn'

/* ─── constants ──────────────────────────────────────────────────────────── */

const DIFFICULTY_LABELS = ['Belirsiz', 'Başlangıç', 'Temel', 'Orta', 'İleri', 'Uzman']
const DIFFICULTY_DOT_COLOR = [
  'bg-zinc-400',
  'bg-emerald-400',
  'bg-teal-400',
  'bg-sky-400',
  'bg-orange-400',
  'bg-rose-500',
]

/* ─── types ──────────────────────────────────────────────────────────────── */

interface Scenario {
  id: string
  title: string
  description: string
  difficulty_level: number
  estimated_duration_min: number
  target_skills: string[]
  mood_hint?: string | null
  context_setup?: string | null
}

interface CinematicPersonaStageProps {
  persona: any
  scenarios: Scenario[]
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */

export function CinematicPersonaStage({ persona, scenarios }: CinematicPersonaStageProps) {
  const router = useRouter()
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [isPending, startTransition] = useTransition()

  // Persona'nın tüm meta-verisini PersonaInfoColumn'a hazırla
  const coachingTipsList: string[] = Array.isArray(persona.coaching_tips)
    ? (persona.coaching_tips as unknown[]).filter((t): t is string => typeof t === 'string' && t.length > 0)
    : []
  const triggerBehaviorsList: string[] = Array.isArray(persona.trigger_behaviors)
    ? (persona.trigger_behaviors as unknown[]).filter((t): t is string => typeof t === 'string' && t.length > 0)
    : []

  const handleStartSession = () => {
    if (!selectedScenario) return
    startTransition(async () => {
      const result = await createSessionAction({
        personaId: persona.id,
        scenarioId: selectedScenario.id,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Seans başlatıldı!')
      router.push(`/dashboard/sessions/${result.sessionId}`)
    })
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* ══════════════════════════════════════════════════════════════════
          LEFT PANEL — Persona info (foto üstte, info kartları altta)
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          flex: '0 0 42%',
          background: 'linear-gradient(155deg, #1a1a2e 0%, #0f0e22 55%, #1c003a 100%)',
        }}
      >
        {/* Back to persona selection */}
        <button
          onClick={() => router.push('/dashboard/sessions/new')}
          className="absolute top-4 left-4 z-20 flex items-center gap-1 text-[11px] font-label tracking-wider text-white/30 hover:text-white/70 transition-colors"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Persona Seç
        </button>

        <PersonaInfoColumn
          name={persona.name as string}
          title={persona.title as string | null}
          department={persona.department as string | null}
          avatarUrl={persona.avatar_image_url as string | null}
          experienceYears={persona.experience_years as number | null}
          growthType={persona.growth_type as string | null}
          emotionalBaseline={persona.emotional_baseline as string | null}
          difficulty={persona.difficulty as number | null}
          resistanceLevel={persona.resistance_level as number | null}
          cooperativeness={persona.cooperativeness as number | null}
          // CinematicPersonaStage'de senaryo henüz seçilmedi → scenarioContext null
          scenarioContext={selectedScenario?.context_setup ?? null}
          coachingContext={persona.coaching_context as string | null}
          coachingTips={coachingTipsList}
          triggerBehaviors={triggerBehaviorsList}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RIGHT PANEL — switches between scenario list and session preview
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ flex: '0 0 58%', background: 'var(--surface, #fcf8ff)' }}
      >
        {selectedScenario === null ? (
          <ScenarioList
            scenarios={scenarios}
            personaName={persona.name as string}
            onSelect={setSelectedScenario}
          />
        ) : (
          <SessionPreview
            scenario={selectedScenario}
            persona={persona}
            isPending={isPending}
            onBack={() => setSelectedScenario(null)}
            onStart={handleStartSession}
          />
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATE A — Scenario list
══════════════════════════════════════════════════════════════════════════ */

function ScenarioList({
  scenarios,
  personaName,
  onSelect,
}: {
  scenarios: Scenario[]
  personaName: string
  onSelect: (s: Scenario) => void
}) {
  return (
    <>
      {/* Header */}
      <div
        className="flex-shrink-0 px-8 py-6"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        <p
          className="font-label font-bold uppercase tracking-[0.24em] mb-1"
          style={{ fontSize: '9px', color: 'rgba(26,26,46,0.35)' }}
        >
          {personaName} · Senaryo Seçimi
        </p>
        <h3
          className="font-headline font-light"
          style={{ fontSize: '1.5rem', lineHeight: 1.2, color: '#1a1a2e' }}
        >
          Hangi senaryoyla{' '}
          <em className="italic" style={{ color: '#7544b6' }}>
            başlamak
          </em>{' '}
          istiyorsun?
        </h3>
      </div>

      {/* Scenario items */}
      <div className="flex-1 overflow-y-auto">
        {scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <span
              className="material-symbols-outlined text-5xl mb-3"
              style={{ color: 'rgba(42,0,86,0.2)' }}
            >
              folder_open
            </span>
            <p style={{ fontSize: '13px', color: 'rgba(26,26,46,0.45)' }}>
              Bu persona için henüz senaryo tanımlanmamış.
            </p>
          </div>
        ) : (
          scenarios.map((scenario) => (
            <ScenarioItem key={scenario.id} scenario={scenario} onSelect={onSelect} />
          ))
        )}
      </div>
    </>
  )
}

function ScenarioItem({
  scenario,
  onSelect,
}: {
  scenario: Scenario
  onSelect: (s: Scenario) => void
}) {
  const lvl = scenario.difficulty_level ?? 3

  return (
    <button
      onClick={() => onSelect(scenario)}
      className="group w-full text-left px-8 py-5 flex items-start gap-5 transition-colors"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.055)' }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(42,0,86,0.035)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {/* Difficulty dots column */}
      <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-full transition-opacity',
              i < lvl ? DIFFICULTY_DOT_COLOR[lvl] : 'bg-gray-200'
            )}
            style={{ width: '6px', height: '6px' }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h4
            className="font-semibold leading-snug transition-colors group-hover:text-[#2a0056]"
            style={{ fontSize: '13px', color: '#1a1a2e' }}
          >
            {scenario.title}
          </h4>
          <div
            className="flex items-center gap-1 flex-shrink-0 mt-0.5 transition-colors group-hover:text-[#7544b6]"
            style={{ color: 'rgba(26,26,46,0.35)', fontSize: '11px' }}
          >
            <span className="font-label font-semibold">{DIFFICULTY_LABELS[lvl]}</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </div>
        </div>

        {scenario.mood_hint && (
          <p
            className="font-headline italic leading-snug"
            style={{ fontSize: '13px', color: 'rgba(26,26,46,0.52)' }}
          >
            &ldquo;{scenario.mood_hint}&rdquo;
          </p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <span
            className="flex items-center gap-1"
            style={{ fontSize: '10px', color: 'rgba(26,26,46,0.35)' }}
          >
            <ClockIcon className="h-3 w-3" />~{scenario.estimated_duration_min} dk
          </span>
          {scenario.target_skills?.slice(0, 3).map((s, i) => (
            <span
              key={i}
              className="rounded-full px-2 py-px font-label font-semibold"
              style={{
                fontSize: '10px',
                background: 'rgba(42,0,86,0.07)',
                color: 'rgba(42,0,86,0.6)',
              }}
            >
              {s.replace(/_/g, ' ')}
            </span>
          ))}
          {(scenario.target_skills?.length ?? 0) > 3 && (
            <span style={{ fontSize: '10px', color: 'rgba(26,26,46,0.3)' }}>
              +{scenario.target_skills.length - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATE B — Session preview (selected scenario + start)
══════════════════════════════════════════════════════════════════════════ */

function SessionPreview({
  scenario,
  persona,
  isPending,
  onBack,
  onStart,
}: {
  scenario: Scenario
  persona: any
  isPending: boolean
  onBack: () => void
  onStart: () => void
}) {
  const lvl = scenario.difficulty_level ?? 3

  return (
    <>
      {/* Header */}
      <div
        className="flex-shrink-0 px-8 py-5"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 mb-3 transition-colors"
          style={{ fontSize: '11px', color: 'rgba(26,26,46,0.4)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#2a0056')}
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color = 'rgba(26,26,46,0.4)')
          }
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Senaryolara Dön
        </button>

        <div className="flex items-start justify-between gap-4">
          <h3
            className="font-semibold leading-snug"
            style={{ fontSize: '15px', color: '#1a1a2e' }}
          >
            {scenario.title}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Difficulty dots row */}
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={cn('rounded-full', i < lvl ? DIFFICULTY_DOT_COLOR[lvl] : 'bg-gray-200')}
                  style={{ width: '7px', height: '7px' }}
                />
              ))}
            </div>
            <span
              className="font-label font-semibold"
              style={{ fontSize: '11px', color: 'rgba(26,26,46,0.45)' }}
            >
              {DIFFICULTY_LABELS[lvl]}
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(26,26,46,0.3)' }}>
              · ~{scenario.estimated_duration_min} dk
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* Mood hint — large italic serif */}
        {scenario.mood_hint && (
          <div>
            <p
              className="font-headline italic leading-relaxed"
              style={{ fontSize: '1.15rem', color: 'rgba(26,26,46,0.7)', lineHeight: 1.5 }}
            >
              &ldquo;{scenario.mood_hint}&rdquo;
            </p>
          </div>
        )}

        {/* Senaryo Bağlamı */}
        {scenario.description && (
          <Section label="Senaryo Bağlamı">
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(26,26,46,0.65)' }}>
              {scenario.description}
            </p>
          </Section>
        )}

        {/* Hedef Yetkinlikler */}
        {(scenario.target_skills?.length ?? 0) > 0 && (
          <Section label="Hedef Yetkinlikler">
            <div className="space-y-2">
              {scenario.target_skills.map((skill, i) => (
                <SkillRow key={i} skill={skill} index={i} total={scenario.target_skills.length} />
              ))}
            </div>
          </Section>
        )}

        {/* Koçluk İpuçları (persona.coaching_tips) */}
        {((persona.coaching_tips as string[] | null)?.length ?? 0) > 0 && (
          <Section label="Koçluk İpuçları">
            <ul className="space-y-2">
              {(persona.coaching_tips as string[]).map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-1 flex-shrink-0 rounded-full"
                    style={{ width: '5px', height: '5px', background: '#9d6bdf', marginTop: '7px' }}
                  />
                  <span className="text-sm leading-relaxed" style={{ color: 'rgba(26,26,46,0.65)' }}>
                    {tip}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

      </div>

      {/* Footer — Start button */}
      <div
        className="flex-shrink-0 px-8 py-5"
        style={{
          borderTop: '1px solid rgba(0,0,0,0.06)',
          background: 'rgba(42,0,86,0.025)',
        }}
      >
        <button
          onClick={onStart}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-3 rounded-xl py-4 font-label font-bold uppercase tracking-[0.18em] transition-all disabled:opacity-60"
          style={{
            fontSize: '13px',
            background: isPending ? '#7544b6' : '#2a0056',
            color: '#fdf8ff',
            boxShadow: '0 4px 24px rgba(42,0,86,0.3)',
          }}
          onMouseEnter={(e) => {
            if (!isPending)
              (e.currentTarget as HTMLElement).style.background = '#3d007c'
          }}
          onMouseLeave={(e) => {
            if (!isPending)
              (e.currentTarget as HTMLElement).style.background = '#2a0056'
          }}
        >
          {isPending ? (
            <>
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Seans oluşturuluyor...
            </>
          ) : (
            <>
              <PlayIcon className="h-4 w-4" style={{ fill: '#fdf8ff' }} />
              Seansı Başlat
            </>
          )}
        </button>
        <p
          className="mt-2.5 text-center font-label"
          style={{ fontSize: '11px', color: 'rgba(26,26,46,0.35)' }}
        >
          Seans istediğin zaman duraklatılabilir veya sonlandırılabilir.
        </p>
      </div>
    </>
  )
}

/* ─── small sub-components ───────────────────────────────────────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <p
          className="font-label font-bold uppercase tracking-[0.2em] flex-shrink-0"
          style={{ fontSize: '9px', color: 'rgba(26,26,46,0.35)' }}
        >
          {label}
        </p>
        <div className="h-px flex-1" style={{ background: 'rgba(0,0,0,0.07)' }} />
      </div>
      {children}
    </div>
  )
}

function SkillRow({ skill, index, total }: { skill: string; index: number; total: number }) {
  // Show bar filling from right to left based on position (earlier = more important)
  const fillPct = Math.round(100 - (index / Math.max(total - 1, 1)) * 40)

  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className="text-xs capitalize"
        style={{ color: 'rgba(26,26,46,0.6)', minWidth: 0, flex: 1 }}
      >
        {skill.replace(/_/g, ' ')}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="rounded-full overflow-hidden"
          style={{ width: '80px', height: '4px', background: 'rgba(26,26,46,0.1)' }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${fillPct}%`, background: '#9d6bdf' }}
          />
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(26,26,46,0.4)', width: '28px' }}>
          {fillPct}%
        </span>
      </div>
    </div>
  )
}

