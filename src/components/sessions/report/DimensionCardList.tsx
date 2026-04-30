'use client'

import { useState, useMemo, useCallback } from 'react'
import styles from './report.module.css'
import {
  getScoreCategory,
  type ReportDimension,
} from './report-utils'
import { ReportRadar } from './ReportRadar'
import { ActionPanel } from './ActionPanel'

interface DimensionCardListProps {
  dimensions: ReportDimension[]
  overallAverage: number
}

type SortMode = 'score' | 'order'

const BAR_CLASS: Record<ReturnType<typeof getScoreCategory>, string> = {
  low: styles.scoreBarLow,
  mid: styles.scoreBarMid,
  high: styles.scoreBarHigh,
}

/**
 * Radar + Boyut Kartları + Aksiyon Paneli — birlikte client component olarak
 * tutuluyor çünkü "scrollToDim" interaction'u ortak.
 */
export function DimensionCardList({ dimensions, overallAverage }: DimensionCardListProps) {
  const [sortMode, setSortMode] = useState<SortMode>('score')
  const [highlight, setHighlight] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const arr = [...dimensions]
    if (sortMode === 'score') {
      arr.sort((a, b) => a.score - b.score)
    } else {
      arr.sort((a, b) => a.sort_order - b.sort_order)
    }
    return arr
  }, [dimensions, sortMode])

  const scrollToDim = useCallback((code: string) => {
    const el = document.getElementById(`dim-${code}`)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top, behavior: 'smooth' })
    setHighlight(code)
    window.setTimeout(() => setHighlight((current) => (current === code ? null : current)), 1700)
  }, [])

  return (
    <>
      {/* Layer 2: Radar */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={`${styles.caps} ${styles.muted}`}>Genel Bakış</span>
          <h2 className={styles.serif}>
            8 boyutu tek bakışta <em>gör.</em>
          </h2>
        </div>
        <ReportRadar
          dimensions={dimensions}
          overallAverage={overallAverage}
          onJump={scrollToDim}
        />
      </section>

      {/* Layer 3: Dimension Cards */}
      <section className={styles.section}>
        <div className={styles.dimsControls}>
          <div className={styles.sectionHead} style={{ marginBottom: 0 }}>
            <span className={`${styles.caps} ${styles.muted}`}>Boyut Detayları</span>
            <h2 className={styles.serif} style={{ fontSize: '1.5rem' }}>
              Seanstaki <em>her</em> davranış, kanıtlı.
            </h2>
          </div>
          <div className={styles.sortToggle} role="tablist" aria-label="Sıralama">
            <button
              type="button"
              role="tab"
              aria-selected={sortMode === 'score'}
              className={`${styles.sortBtn} ${sortMode === 'score' ? styles.active : ''}`}
              onClick={() => setSortMode('score')}
            >
              Skor ↑
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sortMode === 'order'}
              className={`${styles.sortBtn} ${sortMode === 'order' ? styles.active : ''}`}
              onClick={() => setSortMode('order')}
            >
              ICF Sırası
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className={styles.dimEmpty}>Bu seans için boyut bazlı puanlar henüz yok.</p>
        ) : (
          sorted.map((d, idx) => {
            const cat = getScoreCategory(d.score)
            const pct = (d.score / 5) * 100
            return (
              <article
                key={d.code}
                id={`dim-${d.code}`}
                className={`${styles.dimCard} ${highlight === d.code ? styles.highlight : ''}`}
                aria-label={`${d.name} boyutu`}
              >
                <div className={styles.dimTopRow}>
                  <div className={styles.dimCat}>
                    <span className={styles.dimCatLabel}>ICF · TEMEL</span>
                    {d.is_required && (
                      <span className={`${styles.dimCatLabel} ${styles.dimCatLabelAccent}`}>
                        Zorunlu
                      </span>
                    )}
                  </div>
                  <span className={styles.dimOrder}>
                    {String(idx + 1).padStart(2, '0')} / {String(sorted.length).padStart(2, '0')}
                  </span>
                </div>

                <div className={styles.dimTitleRow}>
                  <h3 className={`${styles.dimName} ${styles.serif}`}>{d.name}</h3>
                  <div className={`${styles.dimScore} ${styles.serif}`}>
                    {d.score.toFixed(1)}
                    <span> / 5</span>
                  </div>
                </div>

                {d.description && <p className={styles.dimDesc}>{d.description}</p>}

                <div
                  className={styles.scoreBarWrap}
                  role="progressbar"
                  aria-valuenow={d.score}
                  aria-valuemin={0}
                  aria-valuemax={5}
                  aria-label={`${d.name} skoru ${d.score}`}
                >
                  <div className={styles.scoreBarBg}>
                    <div
                      className={`${styles.scoreBarFill} ${BAR_CLASS[cat]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {d.evidence_quotes.length > 0 && (
                  <>
                    <div className={styles.evidenceLabel}>Transcript&apos;ten Kanıt</div>
                    {d.evidence_quotes.map((q, i) => (
                      <div key={i} className={styles.evidenceBlock}>
                        <p className={styles.evidenceQuote}>&ldquo;{q}&rdquo;</p>
                        <p className={styles.evidenceAttr}>— Sen</p>
                      </div>
                    ))}
                  </>
                )}

                {(d.improvement_tip || d.rationale) && (
                  <div className={styles.doDont}>
                    {d.improvement_tip && (
                      <div className={styles.doCol}>
                        <div className={styles.doColLabel}>
                          <CheckIcon color="#4CAF82" />
                          Bir Sonraki Seansda Dene
                        </div>
                        <ul>
                          <li>{d.improvement_tip}</li>
                        </ul>
                      </div>
                    )}
                    {d.rationale && (
                      <div className={styles.dontCol}>
                        <div className={styles.dontColLabel}>
                          <WarnIcon color="#E8A534" />
                          Neden Önemli
                        </div>
                        <ul>
                          <li>{d.rationale}</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {d.evidence_quotes.length === 0 && !d.improvement_tip && !d.rationale && (
                  <p className={styles.dimEmpty}>Bu boyut için seansta yeterli kanıt toplanamadı.</p>
                )}
              </article>
            )
          })
        )}
      </section>

      {/* Layer 4: Action Panel — aynı scrollToDim ile bağlı */}
      <ActionPanel dimensions={dimensions} onJump={scrollToDim} />
    </>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="2.5">
      <polyline points="2,9 6,5 14,3" />
    </svg>
  )
}

function WarnIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="2.5">
      <path d="M8 3v6" />
      <circle cx="8" cy="12" r="1" fill={color} />
    </svg>
  )
}

