'use client'

import Image from 'next/image'

/**
 * PersonaInfoColumn — Sesli seans + senaryo seçim ekranlarının ortak persona kolonu.
 *
 * Kullanıcı isteği (2026-04-27): Persona fotoğrafı üstte, altında persona bilgileri kartlar
 * halinde — Tenant Admin'in persona detay görünümüne benzer zenginlikte.
 *
 * Render hiyerarşisi:
 *   1. Avatar (büyük, grayscale, purple shadow halo)
 *   2. Name + Title + Emotional Baseline badge
 *   3. Üst sıra: Deneyim, Persona Tipi (2 kart yan yana)
 *   4. Orta sıra: Zorluk / Direnç / İşbirliği (3 kompakt kart)
 *   5. Senaryo Bağlamı (varsa)
 *   6. Koçluk Bağlamı (varsa)
 *   7. Tetikleyici Davranış tag'leri (varsa)
 *   8. Koçluk İpuçları (varsa)
 *
 * Tüm bölümler opsiyonel — verisi olmayan render edilmez.
 */

interface PersonaInfoColumnProps {
  name: string
  title: string | null
  department?: string | null
  avatarUrl?: string | null
  experienceYears?: number | null
  growthType?: string | null
  emotionalBaseline?: string | null
  difficulty?: number | null
  resistanceLevel?: number | null
  cooperativeness?: number | null
  scenarioContext?: string | null      // senaryo bağlamı (scenario.context_setup)
  coachingContext?: string | null      // persona koçluk bağlamı
  coachingTips?: string[]
  triggerBehaviors?: string[]
}

const EMOTIONAL_LABELS: Record<string, string> = {
  motivated: 'Motive',
  demotivated: 'Motivasyonsuz',
  frustrated: 'Hüsranlı',
  neutral: 'Nötr',
  anxious: 'Endişeli',
  confident: 'Kendinden emin',
  burned_out: 'Tükenmiş',
}

const GROWTH_TYPE_LABELS: Record<string, string> = {
  falling_performance: 'Düşen Performans',
  rising_performance: 'Yükselen Performans',
  resistant_experience: 'Dirençli Deneyim',
  new_to_role: 'Yeni Göreve Başlayan',
  motivation_crisis: 'Motivasyon Krizi',
}

export function PersonaInfoColumn({
  name,
  title,
  department,
  avatarUrl,
  experienceYears,
  growthType,
  emotionalBaseline,
  difficulty,
  resistanceLevel,
  cooperativeness,
  scenarioContext,
  coachingContext,
  coachingTips = [],
  triggerBehaviors = [],
}: PersonaInfoColumnProps) {
  const initial = name?.[0] ?? '?'
  const titleAndDept = [title, department].filter(Boolean).join(' · ')

  return (
    <div className="relative flex flex-col h-full overflow-y-auto">
      {/* Purple radial glow background */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          top: '15%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          height: '420px',
          background: 'radial-gradient(circle, rgba(157,107,223,0.14) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-4 px-6 pt-8 pb-6">
        {/* ─── Avatar ─── */}
        <div
          className="relative overflow-hidden rounded-full flex-shrink-0"
          style={{
            width: '180px',
            height: '180px',
            boxShadow: '0 0 0 1px rgba(157,107,223,0.18), 0 0 60px rgba(157,107,223,0.18)',
          }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={name}
              fill
              sizes="180px"
              className="object-cover grayscale brightness-90 contrast-110"
            />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center"
              style={{ background: 'radial-gradient(circle at 40% 35%, #2a0056 0%, #1a1a2e 70%)' }}
            >
              <span
                className="font-headline italic font-light text-6xl"
                style={{ color: 'rgba(196,160,245,0.7)' }}
              >
                {initial}
              </span>
            </div>
          )}
        </div>

        {/* ─── Name + Title + Emotional ─── */}
        <div className="text-center space-y-1.5 max-w-full">
          <h2
            className="font-headline italic font-light tracking-wide truncate"
            style={{ fontSize: '1.875rem', lineHeight: 1.1, color: 'rgba(255,255,255,0.93)' }}
          >
            {name}
          </h2>
          {titleAndDept && (
            <p
              className="font-label font-bold uppercase tracking-[0.24em] text-[10px] truncate"
              style={{ color: '#9d6bdf' }}
            >
              {titleAndDept}
            </p>
          )}
          {emotionalBaseline && EMOTIONAL_LABELS[emotionalBaseline] && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-label font-semibold uppercase tracking-wider mt-1"
              style={{
                background: 'rgba(157,107,223,0.14)',
                color: '#c4a0f5',
                border: '1px solid rgba(157,107,223,0.22)',
              }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#9d6bdf' }} />
              {EMOTIONAL_LABELS[emotionalBaseline]}
            </span>
          )}
        </div>
      </div>

      {/* ─── Info kartlar ─── */}
      <div className="relative z-10 px-6 pb-6 space-y-3">
        {/* Deneyim + Persona Tipi (yan yana) */}
        {(experienceYears != null || growthType) && (
          <div className="grid grid-cols-2 gap-3">
            {experienceYears != null && (
              <InfoCard label="Deneyim" value={`${experienceYears} yıl`} />
            )}
            {growthType && (
              <InfoCard
                label="Persona Tipi"
                value={GROWTH_TYPE_LABELS[growthType] ?? growthType}
              />
            )}
          </div>
        )}

        {/* Zorluk / Direnç / İşbirliği (3'lü kompakt) */}
        {(difficulty != null || resistanceLevel != null || cooperativeness != null) && (
          <div className="grid grid-cols-3 gap-2">
            {difficulty != null && <ScoreCard label="Zorluk" value={difficulty} />}
            {resistanceLevel != null && <ScoreCard label="Direnç" value={resistanceLevel} />}
            {cooperativeness != null && <ScoreCard label="İşbirliği" value={cooperativeness} />}
          </div>
        )}

        {/* Senaryo bağlamı */}
        {scenarioContext && (
          <SectionCard label="Senaryo Bağlamı">
            <p className="text-[12px] leading-relaxed text-white/65 whitespace-pre-line">
              {scenarioContext}
            </p>
          </SectionCard>
        )}

        {/* Koçluk bağlamı */}
        {coachingContext && (
          <SectionCard label="Koçluk Bağlamı">
            <p className="text-[12px] leading-relaxed text-white/65 italic">{coachingContext}</p>
          </SectionCard>
        )}

        {/* Tetikleyici davranış tag'leri */}
        {triggerBehaviors.length > 0 && (
          <SectionCard label="Tetikleyici Davranış">
            <div className="flex flex-wrap gap-1.5">
              {triggerBehaviors.map((t, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    background: 'rgba(157,107,223,0.14)',
                    color: '#c4a0f5',
                    border: '1px solid rgba(157,107,223,0.22)',
                  }}
                >
                  &ldquo;{t}&rdquo;
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Koçluk ipuçları */}
        {coachingTips.length > 0 && (
          <SectionCard label="Koçluk İpuçları" highlight>
            <div className="space-y-1.5">
              {coachingTips.map((tip, i) => (
                <p key={i} className="text-[12px] leading-relaxed text-white/70">
                  • {tip}
                </p>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

/* ─── Helper sub-components ─── */

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5 border"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(157,107,223,0.18)',
      }}
    >
      <p
        className="font-label font-bold uppercase tracking-[0.18em] mb-0.5"
        style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}
      >
        {label}
      </p>
      <p className="text-[13px] font-medium text-white/90 truncate">{value}</p>
    </div>
  )
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg px-2 py-2 text-center border"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(157,107,223,0.18)',
      }}
    >
      <p
        className="font-label font-bold uppercase tracking-[0.14em] mb-0.5"
        style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}
      >
        {label}
      </p>
      <p className="text-base font-bold" style={{ color: '#c4a0f5' }}>
        {value}
        <span className="text-[10px] text-white/40 font-normal">/5</span>
      </p>
    </div>
  )
}

function SectionCard({
  label,
  children,
  highlight = false,
}: {
  label: string
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className="rounded-lg px-3.5 py-3 border"
      style={{
        background: highlight ? 'rgba(157,107,223,0.08)' : 'rgba(255,255,255,0.03)',
        borderColor: highlight ? 'rgba(157,107,223,0.28)' : 'rgba(157,107,223,0.18)',
      }}
    >
      <p
        className="font-label font-bold uppercase tracking-[0.18em] mb-2"
        style={{ fontSize: '9px', color: highlight ? '#c4a0f5' : 'rgba(255,255,255,0.35)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}
